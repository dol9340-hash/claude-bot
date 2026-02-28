#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig } from './config.js';
import { ClaudeBot } from './bot.js';
import { createLogger } from './logger/index.js';
import { parseTasks } from './task/parser.js';
import { SessionManager } from './session/manager.js';
import { SwarmOrchestrator } from './swarm/orchestrator.js';
import { loadSwarmConfig } from './swarm/config-loader.js';
import type { ClaudeBotConfig } from './types.js';

const program = new Command();

program
  .name('claudebot')
  .description('Autonomous task queue orchestrator for Claude Agent SDK')
  .version('0.1.0');

program
  .command('run')
  .description('Execute all pending tasks in the queue')
  .option('-f, --file <path>', 'Path to tasks markdown file')
  .option('-c, --cwd <path>', 'Working directory for agent execution')
  .option('-m, --model <model>', 'Claude model to use')
  .option('-e, --engine <type>', 'Execution engine: sdk or cli')
  .option('--max-retries <n>', 'Max retry attempts per task', parseInt)
  .option('--max-budget <usd>', 'Max total budget in USD', parseFloat)
  .option('--timeout <ms>', 'Task timeout in milliseconds', parseInt)
  .option('--stop-on-failure', 'Stop queue on first task failure')
  .option('--permission-mode <mode>', 'Permission mode: default|acceptEdits|bypassPermissions')
  .option('--log-level <level>', 'Log level: debug|info|warn|error')
  .option('--watch-interval <ms>', 'Poll interval when queue is empty (0 = exit, default 20000)', parseInt)
  .option('--dry-run', 'Parse and display tasks without executing')
  .action(async (opts) => {
    const overrides: Partial<ClaudeBotConfig> = {};
    if (opts.file) overrides.tasksFile = opts.file;
    if (opts.cwd) overrides.cwd = opts.cwd;
    if (opts.model) overrides.model = opts.model;
    if (opts.engine) overrides.engine = opts.engine;
    if (opts.maxRetries !== undefined) overrides.maxRetries = opts.maxRetries;
    if (opts.maxBudget !== undefined) overrides.maxTotalBudgetUsd = opts.maxBudget;
    if (opts.timeout !== undefined) overrides.taskTimeoutMs = opts.timeout;
    if (opts.stopOnFailure) overrides.stopOnFailure = true;
    if (opts.permissionMode) overrides.permissionMode = opts.permissionMode;
    if (opts.logLevel) overrides.logLevel = opts.logLevel;
    if (opts.watchInterval !== undefined) overrides.watchIntervalMs = opts.watchInterval;

    const config = await loadConfig(overrides);
    const logger = createLogger(config.logLevel);

    if (opts.dryRun) {
      const tasks = parseTasks(config.tasksFile);
      logger.info({ taskCount: tasks.length }, 'Dry run: parsed tasks');
      for (const task of tasks) {
        console.log(`  Line ${task.line}: ${task.prompt}`);
        if (Object.keys(task.tags).length > 0) {
          console.log(`    Tags: ${JSON.stringify(task.tags)}`);
        }
      }
      process.exit(0);
    }

    const bot = new ClaudeBot(config, logger);

    // Graceful shutdown
    const shutdown = () => {
      logger.info('Received shutdown signal, aborting gracefully...');
      bot.abort();
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    const result = await bot.run();
    process.exit(result.failed > 0 ? 1 : 0);
  });

program
  .command('swarm')
  .description('Run a multi-bot BotGraph swarm from config')
  .option('--config <path>', 'Path to claudebot.swarm.json', 'claudebot.swarm.json')
  .option('--log-level <level>', 'Log level: debug|info|warn|error', 'info')
  .option('--dry-run', 'Validate config and show bot topology without executing')
  .action(async (opts) => {
    const logger = createLogger(opts.logLevel);

    try {
      if (opts.dryRun) {
        const config = loadSwarmConfig(opts.config);
        const sg = config.swarmGraph;

        console.log('\n=== BotGraph Dry Run ===');
        console.log(`Workspace: ${sg.workspacePath}`);
        console.log(`Entry bots: ${sg.entryBots.join(', ')}`);
        console.log(`Total bots: ${Object.keys(sg.bots).length}`);
        console.log(`Budget: ${config.maxTotalBudgetUsd ? `$${config.maxTotalBudgetUsd}` : 'unlimited'}`);
        console.log(`Engine: ${config.engine}`);
        console.log(`Max routing cycles: ${sg.message.maxRoutingCycles}`);
        console.log(`Grace period: ${sg.termination.gracePeriodMs}ms`);

        console.log('\nBots:');
        for (const [name, def] of Object.entries(sg.bots)) {
          const isEntry = sg.entryBots.includes(name);
          const label = isEntry ? ' [ENTRY]' : '';
          console.log(`  ${name}${label}`);
          console.log(`    Model: ${def.model}`);
          console.log(`    Can contact: ${def.canContact.length > 0 ? def.canContact.join(', ') : 'none'}`);
          console.log(`    Watches: ${def.watchesFiles.length > 0 ? def.watchesFiles.join(', ') : 'inbox only'}`);
          console.log(`    Budget/task: ${def.maxBudgetPerTaskUsd ? `$${def.maxBudgetPerTaskUsd}` : 'unlimited'}`);
          console.log(`    Terminates on empty: ${def.terminatesOnEmpty}`);
          if (def.allowedTools) {
            console.log(`    Tools: ${def.allowedTools.join(', ')}`);
          }
        }

        console.log('');
        process.exit(0);
      }

      const orchestrator = SwarmOrchestrator.fromConfigFile(
        opts.config,
        process.cwd(),
        logger,
      );

      // Graceful shutdown
      const shutdown = () => {
        logger.info('Received shutdown signal, aborting swarm...');
        orchestrator.abortAll();
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      const result = await orchestrator.run();

      // Print summary
      console.log('\n=== BotGraph Swarm Summary ===');
      console.log(`Total bots: ${result.totalBots}`);
      console.log(`Completed: ${result.botsCompleted}`);
      console.log(`Failed: ${result.botsFailed}`);
      console.log(`Total cost: $${result.totalCostUsd.toFixed(4)}`);
      console.log(`Duration: ${(result.totalDurationMs / 1000).toFixed(1)}s`);

      if (result.botResults.length > 0) {
        console.log('\nPer-bot results:');
        for (const bot of result.botResults) {
          const cost = bot.costUsd > 0 ? `$${bot.costUsd.toFixed(4)}` : 'N/A';
          console.log(`  ${bot.name}: ${bot.completed} done, ${bot.failed} failed, cost: ${cost}`);
        }
      }

      console.log('');
      process.exit(result.botsFailed > 0 ? 1 : 0);
    } catch (err) {
      logger.error({ error: String(err) }, 'Swarm failed');
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show session history and cost summary')
  .option('--log-level <level>', 'Log level', 'info')
  .option('--swarm', 'Show per-bot swarm cost summary')
  .action(async (opts) => {
    const config = await loadConfig({ logLevel: opts.logLevel });
    const logger = createLogger(config.logLevel);
    const manager = new SessionManager(config.sessionStorePath, config.cwd, logger);
    const store = manager.getStore();

    console.log('\n=== ClaudeBot Session History ===');
    console.log(`Total cost: $${store.totalCostUsd.toFixed(4)}`);
    console.log(`Total tasks recorded: ${store.records.length}`);

    if (store.records.length > 0) {
      console.log('\nRecent tasks:');
      for (const record of store.records.slice(-10)) {
        const cost = record.costUsd > 0 ? `$${record.costUsd.toFixed(4)}` : 'N/A';
        const duration = `${(record.durationMs / 1000).toFixed(1)}s`;
        const prompt = record.taskPrompt.length > 60
          ? record.taskPrompt.substring(0, 57) + '...'
          : record.taskPrompt;
        console.log(
          `  [${record.engine}] Line ${record.taskLine}: ${record.status} | ${cost} | ${duration} | ${prompt}`,
        );
      }
    }

    if (opts.swarm) {
      try {
        const swarmConfig = loadSwarmConfig();
        const fs = await import('node:fs');
        const path = await import('node:path');

        console.log('\n=== BotGraph Cost Summary ===');
        const wp = path.resolve(process.cwd(), swarmConfig.swarmGraph.workspacePath);

        for (const botName of Object.keys(swarmConfig.swarmGraph.bots)) {
          const botSessionPath = path.join(wp, botName, 'sessions.json');
          if (fs.existsSync(botSessionPath)) {
            const raw = fs.readFileSync(botSessionPath, 'utf-8');
            const botStore = JSON.parse(raw);
            console.log(`  ${botName}: $${(botStore.totalCostUsd ?? 0).toFixed(4)} (${(botStore.records?.length ?? 0)} tasks)`);
          } else {
            console.log(`  ${botName}: no session data`);
          }
        }
      } catch {
        console.log('\n(No swarm config found for --swarm summary)');
      }
    }

    console.log('');
  });

program.parse();
