import path from 'node:path';
import type { Logger } from 'pino';
import { ClaudeBot } from '../bot.js';
import type { SwarmFileConfig, BotDefinition, BotRuntimeInfo, BotRuntimeStatus } from './types.js';
import { BotDefinitionSchema } from './types.js';
import { loadSwarmConfig } from './config-loader.js';
import { buildBotConfig, buildBotSystemContext } from './bot-factory.js';
import { bootstrapWorkspace } from './workspace.js';
import { BulletinBoard } from './board.js';
import { InboxManager } from './inbox.js';
import { RegistryManager } from './registry.js';
import { getEventBus } from '../events/index.js';

interface BotInstance {
  name: string;
  bot: ClaudeBot;
  status: BotRuntimeStatus;
  costUsd: number;
  tasksCompleted: number;
  tasksFailed: number;
  startedAt: string;
  lastActivityAt: string;
}

export interface SwarmRunResult {
  totalBots: number;
  botsCompleted: number;
  botsFailed: number;
  totalCostUsd: number;
  totalDurationMs: number;
  botResults: Array<{
    name: string;
    completed: number;
    failed: number;
    costUsd: number;
  }>;
}

/**
 * SwarmOrchestrator — spawns N ClaudeBot instances from config,
 * runs them in parallel, and manages termination.
 *
 * Generic: iterates Object.entries(config.swarmGraph.bots),
 * no bot names are hardcoded.
 */
export class SwarmOrchestrator {
  private config: SwarmFileConfig;
  private projectRoot: string;
  private logger: Logger;
  private instances: Map<string, BotInstance> = new Map();
  private dynamicPromises: Array<Promise<void>> = [];
  private board: BulletinBoard;
  private inbox: InboxManager;
  private registry: RegistryManager;
  private aborted = false;

  constructor(config: SwarmFileConfig, projectRoot: string, logger: Logger) {
    this.config = config;
    this.projectRoot = projectRoot;
    this.logger = logger;

    const workspacePath = path.resolve(projectRoot, config.swarmGraph.workspacePath);

    this.board = new BulletinBoard(
      workspacePath,
      config.swarmGraph.boardFile,
      logger,
    );

    this.inbox = new InboxManager(
      workspacePath,
      config.swarmGraph,
      logger,
    );

    this.registry = new RegistryManager(
      workspacePath,
      config.swarmGraph.registryFile,
      logger,
    );
  }

  /**
   * Static factory: load config from file and create orchestrator.
   */
  static fromConfigFile(
    configPath: string | undefined,
    projectRoot: string,
    logger: Logger,
  ): SwarmOrchestrator {
    const config = loadSwarmConfig(configPath, projectRoot);
    return new SwarmOrchestrator(config, projectRoot, logger);
  }

  /**
   * Bootstrap workspace and run all bots in parallel.
   */
  async run(): Promise<SwarmRunResult> {
    const startTime = Date.now();

    // 1. Bootstrap workspace
    bootstrapWorkspace(this.config, this.projectRoot, this.logger);
    this.board.init();
    this.inbox.init();
    this.registry.init();

    // 2. Post start to board
    this.board.post(
      'orchestrator',
      'SWARM_START',
      `Starting ${Object.keys(this.config.swarmGraph.bots).length} bots.`,
    );

    const bus = getEventBus();

    // 3. Create ClaudeBot instances for each bot
    for (const [name, def] of Object.entries(this.config.swarmGraph.bots)) {
      this.createBotInstance(name, def);
    }

    bus.emit('swarm:started', {
      botCount: this.instances.size,
      timestamp: new Date().toISOString(),
    });

    // 4. Run all bot instances in parallel
    this.logger.info(
      { botCount: this.instances.size },
      'Starting all bots',
    );

    const botPromises: Array<Promise<void>> = [];

    for (const [name, instance] of this.instances) {
      const promise = this.runBot(name, instance);
      botPromises.push(promise);
    }

    // 5. Monitor for SWARM_COMPLETE signal in parallel
    const monitorPromise = this.monitorCompletion();
    botPromises.push(monitorPromise);

    // Wait for all bots to finish (or be aborted)
    await Promise.allSettled(botPromises);

    // Also wait for dynamically added bots
    if (this.dynamicPromises.length > 0) {
      await Promise.allSettled(this.dynamicPromises);
    }

    // 6. Collect results
    const totalDurationMs = Date.now() - startTime;
    const botResults: SwarmRunResult['botResults'] = [];
    let totalCostUsd = 0;
    let botsCompleted = 0;
    let botsFailed = 0;

    for (const [name, instance] of this.instances) {
      botResults.push({
        name,
        completed: instance.tasksCompleted,
        failed: instance.tasksFailed,
        costUsd: instance.costUsd,
      });
      totalCostUsd += instance.costUsd;
      if (instance.tasksFailed > 0) botsFailed++;
      else botsCompleted++;
    }

    this.board.post(
      'orchestrator',
      'SWARM_DONE',
      `All bots finished. Total cost: $${totalCostUsd.toFixed(4)}. Duration: ${(totalDurationMs / 1000).toFixed(1)}s.`,
    );

    this.logger.info({
      totalBots: this.instances.size,
      botsCompleted,
      botsFailed,
      totalCostUsd: `$${totalCostUsd.toFixed(4)}`,
      totalDuration: `${(totalDurationMs / 1000).toFixed(1)}s`,
    }, 'Swarm execution complete');

    return {
      totalBots: this.instances.size,
      botsCompleted,
      botsFailed,
      totalCostUsd,
      totalDurationMs,
      botResults,
    };
  }

  /** Create a bot instance from a definition and add to instances map. */
  private createBotInstance(name: string, def: BotDefinition): BotInstance {
    const botConfig = buildBotConfig(name, def, this.config, this.projectRoot);
    const contextPrompt = buildBotSystemContext(name, def, this.config);
    botConfig.systemPromptPrefix = (botConfig.systemPromptPrefix ?? '') + contextPrompt;

    const bot = new ClaudeBot(botConfig, this.logger);
    const now = new Date().toISOString();

    const instance: BotInstance = {
      name,
      bot,
      status: 'idle',
      costUsd: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      startedAt: now,
      lastActivityAt: now,
    };

    this.instances.set(name, instance);

    this.logger.info(
      { botName: name, model: def.model, engine: botConfig.engine },
      'Bot instance created',
    );

    getEventBus().emit('bot:created', {
      name,
      model: def.model,
      timestamp: now,
    });

    return instance;
  }

  /**
   * Dynamically add a bot at runtime (Phase 4 Orchestrator API).
   * Validates the definition, registers inbox, creates and starts the bot.
   */
  addBot(name: string, rawDef: Record<string, unknown>): BotInstance {
    if (this.instances.has(name)) {
      throw new Error(`Bot "${name}" already exists`);
    }

    if (this.instances.size >= this.config.maxConcurrentBots) {
      throw new Error(`Max concurrent bots (${this.config.maxConcurrentBots}) reached`);
    }

    // Validate definition
    const def = BotDefinitionSchema.parse(rawDef);

    // Validate canContact targets exist
    for (const target of def.canContact) {
      if (!(target in this.config.swarmGraph.bots) && !this.instances.has(target)) {
        throw new Error(`canContact target "${target}" does not exist`);
      }
    }

    // Register in config so inbox and other bots can reference it
    this.config.swarmGraph.bots[name] = def;

    // Register inbox
    this.inbox.registerBot(name);

    // Create and start the bot
    const instance = this.createBotInstance(name, def);
    const promise = this.runBot(name, instance);
    this.dynamicPromises.push(promise);

    this.board.post('orchestrator', 'BOT_ADDED', `Dynamic bot "${name}" created and started.`);

    return instance;
  }

  /**
   * Remove a running bot at runtime (Phase 4 Orchestrator API).
   */
  removeBot(name: string): void {
    const instance = this.instances.get(name);
    if (!instance) {
      throw new Error(`Bot "${name}" not found`);
    }

    if (instance.status === 'working' || instance.status === 'waiting') {
      instance.bot.abort();
    }

    instance.status = 'stopped';
    instance.lastActivityAt = new Date().toISOString();

    this.inbox.unregisterBot(name);
    delete this.config.swarmGraph.bots[name];

    this.logger.info({ botName: name }, 'Bot removed');
    this.board.post('orchestrator', 'BOT_REMOVED', `Bot "${name}" removed.`);

    getEventBus().emit('bot:completed', {
      name,
      completed: instance.tasksCompleted,
      failed: instance.tasksFailed,
      costUsd: instance.costUsd,
      timestamp: new Date().toISOString(),
    });
  }

  /** Run a single bot instance and track its results. */
  private async runBot(name: string, instance: BotInstance): Promise<void> {
    instance.status = 'working';
    instance.lastActivityAt = new Date().toISOString();

    const bus = getEventBus();

    try {
      const result = await instance.bot.run();

      instance.tasksCompleted = result.completed;
      instance.tasksFailed = result.failed;
      instance.costUsd = result.totalCostUsd;
      instance.status = result.failed > 0 ? 'error' : 'idle';
      instance.lastActivityAt = new Date().toISOString();

      this.logger.info({
        botName: name,
        completed: result.completed,
        failed: result.failed,
        cost: `$${result.totalCostUsd.toFixed(4)}`,
      }, 'Bot finished');

      bus.emit('bot:completed', {
        name,
        completed: result.completed,
        failed: result.failed,
        costUsd: result.totalCostUsd,
        timestamp: instance.lastActivityAt,
      });

      bus.emit('cost:update', {
        botName: name,
        taskCostUsd: result.totalCostUsd,
        totalCostUsd: this.getTotalCost(),
        budgetPercent: this.config.maxTotalBudgetUsd
          ? (this.getTotalCost() / this.config.maxTotalBudgetUsd) * 100
          : null,
        timestamp: instance.lastActivityAt,
      });
    } catch (err) {
      instance.status = 'error';
      instance.lastActivityAt = new Date().toISOString();

      this.logger.error(
        { botName: name, error: String(err) },
        'Bot crashed',
      );

      this.board.post(name, 'ERROR', `Bot crashed: ${String(err)}`);
    }
  }

  /** Monitor board for SWARM_COMPLETE signal. */
  private async monitorCompletion(): Promise<void> {
    const gracePeriodMs = this.config.swarmGraph.termination.gracePeriodMs;
    const checkIntervalMs = 5_000;

    while (!this.aborted) {
      await new Promise(resolve => setTimeout(resolve, checkIntervalMs));

      if (this.board.isSwarmComplete()) {
        this.logger.info(
          { gracePeriodMs },
          'SWARM_COMPLETE detected, starting grace period',
        );

        // Wait grace period for in-flight tasks
        await new Promise(resolve => setTimeout(resolve, gracePeriodMs));

        // Abort all bots
        this.abortAll();
        return;
      }

      // Also check if all bots have stopped (no SWARM_COMPLETE but all done)
      const allStopped = Array.from(this.instances.values()).every(
        i => i.status === 'idle' || i.status === 'error' || i.status === 'stopped',
      );
      if (allStopped && this.instances.size > 0) {
        this.logger.info('All bots have stopped, ending swarm');
        return;
      }
    }
  }

  /** Abort all running bot instances. */
  abortAll(): void {
    this.aborted = true;
    for (const [name, instance] of this.instances) {
      if (instance.status === 'working' || instance.status === 'waiting') {
        instance.bot.abort();
        instance.status = 'stopped';
        this.logger.info({ botName: name }, 'Bot aborted');
      }
    }
  }

  /** Get total cost across all bots. */
  getTotalCost(): number {
    let total = 0;
    for (const instance of this.instances.values()) {
      total += instance.costUsd;
    }
    return total;
  }

  /** Get runtime info for all bots (for status display). */
  getBotRuntimeInfo(): BotRuntimeInfo[] {
    return Array.from(this.instances.values()).map(i => ({
      name: i.name,
      status: i.status,
      costUsd: i.costUsd,
      tasksCompleted: i.tasksCompleted,
      tasksFailed: i.tasksFailed,
      startedAt: i.startedAt,
      lastActivityAt: i.lastActivityAt,
    }));
  }

  /** Get the bulletin board instance. */
  getBoard(): BulletinBoard {
    return this.board;
  }

  /** Get the inbox manager instance. */
  getInboxManager(): InboxManager {
    return this.inbox;
  }

  /** Get the registry manager instance. */
  getRegistry(): RegistryManager {
    return this.registry;
  }
}
