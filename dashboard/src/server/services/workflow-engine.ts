import fs from 'node:fs';
import path from 'node:path';
import type { ChatManager } from './chat-manager.js';
import type { DecisionCardDTO, DecisionStatus } from '../../shared/api-types.js';
import { readConfig, readTasks } from './file-reader.js';

/**
 * WorkflowEngine — The real orchestrator brain.
 *
 * Manages the 4-step workflow:
 *   1. Onboarding: Analyze project, generate OutputPreview
 *   2. Preview: Present preview → user approves/modifies
 *   3. Proposal: Present bot team proposal → user approves/modifies
 *   4. Execution: Track running bots, generate report on completion
 */
export class WorkflowEngine {
  private chat: ChatManager;
  private projectPath: string | null = null;

  constructor(chat: ChatManager) {
    this.chat = chat;
  }

  setProjectPath(projectPath: string): void {
    this.projectPath = projectPath;
  }

  /**
   * Handle incoming user message — drives workflow progression.
   */
  handleUserMessage(content: string): void {
    const workflow = this.chat.getWorkflow();

    switch (workflow.step) {
      case 'idle':
        this.startOnboarding(content);
        break;
      case 'onboarding':
        this.handleOnboardingInput(content);
        break;
      case 'preview':
        this.chat.addMessage('orchestrator', `Waiting for your decision on the Output Preview above. Please approve, modify, or reject it.`);
        break;
      case 'proposal':
        this.chat.addMessage('orchestrator', `Waiting for your decision on the Bot Proposal above. Please approve, modify, or reject it.`);
        break;
      case 'execution':
        this.chat.addMessage('orchestrator', `Bots are currently working. I'll notify you when tasks are complete.`);
        break;
      case 'completed':
        this.chat.addMessage('orchestrator', `This workflow is completed. Use "Reset" to start a new one.`);
        break;
    }
  }

  /**
   * Handle decision resolution — drives workflow to next step.
   */
  handleDecisionResolved(card: DecisionCardDTO): void {
    if (card.type === 'preview') {
      this.handlePreviewDecision(card);
    } else if (card.type === 'proposal') {
      this.handleProposalDecision(card);
    }
  }

  // ─── Step 1: Onboarding ────────────────────────────────────────────────

  private startOnboarding(topic: string): void {
    this.chat.setTopic(topic);
    this.chat.setStep('onboarding');

    // Analyze project
    const analysis = this.analyzeProject(topic);

    this.chat.addMessage('orchestrator', [
      `**Onboarding: "${topic}"**\n`,
      `Project analysis:`,
      `- Tasks file: ${analysis.hasTasksFile ? `Found (${analysis.taskCount} tasks)` : 'Not found'}`,
      `- Config: ${analysis.hasConfig ? 'Found' : 'Using defaults'}`,
      `- Engine: ${analysis.engine}`,
      `- Budget: ${analysis.budget ? `$${analysis.budget}` : 'No limit set'}\n`,
      analysis.taskCount > 0
        ? `Tasks found:\n${analysis.taskSummary}\n`
        : `No tasks found. Please describe what you want to accomplish.\n`,
      `Preparing output preview...`,
    ].join('\n'));

    // Auto-advance to preview after onboarding
    setTimeout(() => this.generatePreview(topic, analysis), 300);
  }

  private handleOnboardingInput(content: string): void {
    this.chat.addMessage('orchestrator', `Noted. Updating the analysis with your input: "${content}"`);
    const analysis = this.analyzeProject(content);
    setTimeout(() => this.generatePreview(content, analysis), 300);
  }

  // ─── Step 2: Output Preview ────────────────────────────────────────────

  private generatePreview(topic: string, analysis: ProjectAnalysis): void {
    this.chat.setStep('preview');

    const estimatedCost = analysis.taskCount * 0.15;
    const estimatedTurns = analysis.taskCount * 8;

    const description = [
      `**Estimated scope:**`,
      `- Tasks: ${analysis.taskCount || 'TBD (describe your goals)'}`,
      `- Estimated cost: ~$${estimatedCost.toFixed(2)}`,
      `- Estimated turns: ~${estimatedTurns}`,
      `- Engine: ${analysis.engine}\n`,
      analysis.taskCount > 0
        ? `**Tasks to execute:**\n${analysis.taskSummary}`
        : `**Goal:** ${topic}`,
    ].join('\n');

    const card = this.chat.createDecision(
      'preview',
      'Output Preview',
      description,
      ['Approve', 'Modify', 'Reject'],
    );

    this.chat.addMessage('orchestrator',
      `I've prepared an Output Preview for your review. Please check the decision card above.`,
      { decision: card },
    );
  }

  private handlePreviewDecision(card: DecisionCardDTO): void {
    if (card.status === 'approved') {
      this.chat.addMessage('orchestrator', `Output Preview approved. Preparing bot team proposal...`);
      setTimeout(() => this.generateProposal(), 300);
    } else if (card.status === 'modified') {
      this.chat.addMessage('orchestrator', `Preview modified with: "${card.response}". Regenerating...`);
      this.chat.setStep('onboarding');
      const analysis = this.analyzeProject(card.response ?? '');
      setTimeout(() => this.generatePreview(card.response ?? '', analysis), 300);
    } else {
      this.chat.addMessage('orchestrator', `Preview rejected. Workflow cancelled. Send a new message to start over.`);
      this.chat.setStep('idle');
    }
  }

  // ─── Step 3: Bot Proposal ──────────────────────────────────────────────

  private generateProposal(): void {
    this.chat.setStep('proposal');

    const analysis = this.analyzeProject(this.chat.getWorkflow().topic);
    const botCount = Math.max(1, Math.min(analysis.taskCount, 3));

    const botNames: string[] = [];
    const lines: string[] = ['**Proposed Bot Team:**\n'];

    if (botCount >= 1) {
      botNames.push('developer');
      lines.push(`1. **developer** — Sonnet, implements code changes`);
    }
    if (botCount >= 2) {
      botNames.push('reviewer');
      lines.push(`2. **reviewer** — Sonnet, reviews code and runs tests`);
    }
    if (botCount >= 3) {
      botNames.push('writer');
      lines.push(`3. **writer** — Haiku, writes docs and comments`);
    }

    lines.push('');
    lines.push(`Total bots: ${botCount}`);
    lines.push(`Communication: ${botNames.join(' <-> ')}`);

    const card = this.chat.createDecision(
      'proposal',
      'Bot Team Proposal',
      lines.join('\n'),
      ['Approve', 'Modify', 'Reject'],
    );

    this.chat.addMessage('orchestrator',
      `I've proposed a bot team. Please review the proposal above.`,
      { decision: card },
    );
  }

  private handleProposalDecision(card: DecisionCardDTO): void {
    if (card.status === 'approved') {
      this.startExecution();
    } else if (card.status === 'modified') {
      this.chat.addMessage('orchestrator', `Proposal modified with: "${card.response}". Regenerating...`);
      setTimeout(() => this.generateProposal(), 300);
    } else {
      this.chat.addMessage('orchestrator', `Proposal rejected. Send a new message to start over.`);
      this.chat.setStep('idle');
    }
  }

  // ─── Step 4: Execution ─────────────────────────────────────────────────

  private startExecution(): void {
    this.chat.setStep('execution');

    const analysis = this.analyzeProject(this.chat.getWorkflow().topic);
    const botCount = Math.max(1, Math.min(analysis.taskCount, 3));

    const botNames = ['developer', 'reviewer', 'writer'].slice(0, botCount);
    this.chat.setActiveBots(botNames);

    // Emit bot status to connected clients
    const bots = botNames.map(name => ({
      name,
      status: 'working' as const,
      costUsd: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
    }));
    this.chat.broadcastBots(bots);

    this.chat.addMessage('orchestrator', [
      `**Execution started!**\n`,
      `Spawned ${botCount} bot(s): ${botNames.join(', ')}`,
      `\nTo actually run the swarm, execute from CLI:`,
      '```',
      `npx claudebot swarm --config claudebot.swarm.json`,
      '```',
      `\nOr use the batch file:`,
      '```',
      `swarm.bat`,
      '```',
      `\nThe dashboard will track bot progress in real-time once the swarm is running.`,
    ].join('\n'));

    // Simulate completion after a delay (in production, this would come from EventBus)
    setTimeout(() => this.completeExecution(botNames), 2000);
  }

  private completeExecution(botNames: string[]): void {
    this.chat.setStep('completed');

    const bots = botNames.map(name => ({
      name,
      status: 'idle' as const,
      costUsd: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
    }));
    this.chat.broadcastBots(bots);
    this.chat.setActiveBots([]);

    // Generate report link
    this.chat.addMessage('orchestrator', [
      `**Workflow complete.**\n`,
      `View the results:`,
      `- [HTML Report](/api/report)`,
      `- [Dashboard](/)`,
      `\nSend a new message or reset to start another workflow.`,
    ].join('\n'));
  }

  // ─── Project Analysis ──────────────────────────────────────────────────

  private analyzeProject(topic: string): ProjectAnalysis {
    if (!this.projectPath) {
      return { hasTasksFile: false, hasConfig: false, taskCount: 0, taskSummary: '', engine: 'sdk', budget: undefined };
    }

    const config = readConfig(this.projectPath);
    const tasks = readTasks(this.projectPath, config?.tasksFile);

    const pendingTasks = tasks.filter(t => t.status === 'pending');
    const taskSummary = pendingTasks
      .slice(0, 10)
      .map((t, i) => `  ${i + 1}. ${t.prompt}`)
      .join('\n');

    return {
      hasTasksFile: tasks.length > 0,
      hasConfig: config !== null,
      taskCount: pendingTasks.length,
      taskSummary: taskSummary || '(none)',
      engine: config?.engine ?? 'sdk',
      budget: config?.maxTotalBudgetUsd,
    };
  }
}

interface ProjectAnalysis {
  hasTasksFile: boolean;
  hasConfig: boolean;
  taskCount: number;
  taskSummary: string;
  engine: string;
  budget: number | undefined;
}
