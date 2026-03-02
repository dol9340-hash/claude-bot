import type { ChatManager } from './chat-manager.js';
import type { BotComposer, BotSpec, BotTaskResult } from './bot-composer.js';
import type { MessageQueue } from './message-queue.js';
import type { SessionManager } from './session-manager.js';
import type { DecisionCardDTO, EpicSummary } from '../../shared/api-types.js';
import { readConfig, readAgentsMd, scanDocsFolder } from './file-reader.js';
import { buildPredictionHtml, buildDocumentationTabs, buildReviewHtml } from './html-preview.js';

/**
 * WorkflowEngine — 5-Phase Conversation-driven Development Orchestrator
 *
 * Phase 1 (Onboarding):     자유 대화, 프로젝트 파악, 목표 설정
 * Phase 2 (Prediction):     코드베이스 분석, Output Preview 생성
 * Phase 3 (Documentation):  PRD, TechSpec, Task 문서 자동 생성
 * Phase 4 (Development):    봇 팀 구성, 코드 개발 실행
 * Phase 5 (Review):         결과 검증, 목표 달성도 확인
 *
 * 핵심 원칙: 모든 Phase 전환은 사용자의 명시적 의사에 의함.
 */
export class WorkflowEngine {
  private chat: ChatManager;
  private botComposer: BotComposer | null = null;
  private messageQueue: MessageQueue | null = null;
  private sessionManager: SessionManager | null = null;
  private projectPath: string | null = null;
  private conversationContext: string[] = [];
  private projectContext: ProjectContext | null = null;

  // Development state
  private devStartedAt: string | null = null;
  private devResults: BotTaskResult[] = [];
  private stopRequested = false;
  private devHeartbeatTimer: NodeJS.Timeout | null = null;

  constructor(chat: ChatManager) {
    this.chat = chat;
  }

  // ─── Dependency Injection ────────────────────────────────────────────────

  setBotComposer(composer: BotComposer): void {
    this.botComposer = composer;
  }

  setMessageQueue(queue: MessageQueue): void {
    this.messageQueue = queue;
  }

  setSessionManager(sm: SessionManager): void {
    this.sessionManager = sm;
  }

  setProjectPath(projectPath: string): void {
    this.projectPath = projectPath;
  }

  /**
   * Reset transient in-memory engine state.
   * Chat/workflow persistence is managed by ChatManager.
   */
  reset(): void {
    this.stopDevelopmentHeartbeat();
    this.conversationContext = [];
    this.devResults = [];
    this.devStartedAt = null;
    this.stopRequested = false;
    this.projectContext = null;
    this.chat.setTopic('');
  }

  /**
   * Initialize project — read AGENTS.md + docs/, then proactively greet user.
   */
  initializeProject(projectPath: string): void {
    this.projectPath = projectPath;

    const workflow = this.chat.getWorkflow();
    this.conversationContext = workflow.topic ? [workflow.topic] : [];
    this.devResults = [];
    this.devStartedAt = null;
    this.stopRequested = false;
    this.projectContext = null;

    if (workflow.step !== 'idle') return;

    // Start clean when proactive onboarding begins.
    this.chat.setTopic('');

    const agentsMd = readAgentsMd(projectPath);
    const docs = scanDocsFolder(projectPath);
    const config = readConfig(projectPath);

    this.projectContext = { agentsMd, docs, config };

    const lines: string[] = [];
    lines.push(`안녕하세요! ClaudeBot입니다.\n`);

    const folderName = projectPath.split(/[\\/]/).pop() ?? projectPath;
    lines.push(`**프로젝트:** \`${folderName}\`\n`);

    if (agentsMd) {
      const preview = agentsMd.split('\n').slice(0, 8).join('\n');
      lines.push(`**AGENTS.md**를 발견했습니다:`);
      lines.push('```');
      lines.push(preview);
      lines.push('```\n');
    }

    if (docs) {
      const fileNames = Object.keys(docs);
      lines.push(`**docs/** 폴더에서 ${fileNames.length}개 문서를 발견했습니다:`);
      for (const name of fileNames) {
        const firstLine = docs[name].split('\n').find(l => l.trim().startsWith('#'))?.replace(/^#+\s*/, '') ?? '';
        lines.push(`- **${name}** ${firstLine ? `— ${firstLine}` : ''}`);
      }
      lines.push('');
    }

    if (config) {
      lines.push(`**설정:** 모델 ${config.model ?? '기본값'}, 예산 ${config.maxTotalBudgetUsd ? `$${config.maxTotalBudgetUsd}` : '미설정'}\n`);
    }

    if (agentsMd || docs) {
      lines.push(`프로젝트 문서를 확인했습니다. 어떤 작업을 도와드릴까요?`);
      lines.push(`구체적인 목표를 말씀해 주시면 바로 시작하겠습니다.`);
    } else {
      lines.push(`프로젝트 폴더를 확인했지만, 아직 문서가 없습니다.`);
      lines.push(`어떤 프로젝트인지 설명해 주시면 함께 시작하겠습니다.`);
    }

    this.chat.setStep('onboarding');
    this.chat.addMessage('orchestrator', lines.join('\n'));
  }

  /**
   * Handle user message — route by current workflow step
   */
  handleUserMessage(content: string): void {
    const workflow = this.chat.getWorkflow();

    // Stop command during development
    if (workflow.step === 'development' && this.isStopCommand(content)) {
      this.handleStopCommand();
      return;
    }

    switch (workflow.step) {
      case 'idle':
        this.startOnboarding(content);
        break;
      case 'onboarding':
        this.handleOnboardingChat(content);
        break;
      case 'prediction':
        this.chat.addMessage('orchestrator',
          `Output Preview에 대한 결정을 내려주세요. (Approve / Modify / Reject)`);
        break;
      case 'documentation':
        this.chat.addMessage('orchestrator',
          `생성된 문서에 대한 결정을 내려주세요. (Approve / Modify / Reject)`);
        break;
      case 'development':
        this.chat.addMessage('orchestrator',
          `개발이 진행 중입니다. "중단" 또는 "stop"으로 중단할 수 있습니다.`);
        break;
      case 'review':
        this.chat.addMessage('orchestrator',
          `리뷰 결과에 대한 최종 확인을 내려주세요. (Approve / Reject)`);
        break;
      case 'completed':
        this.handleCompletedChat(content);
        break;
    }
  }

  /**
   * Handle decision resolution — route by decision type
   */
  handleDecisionResolved(card: DecisionCardDTO): void {
    switch (card.type) {
      case 'prediction':
        this.handlePredictionDecision(card);
        break;
      case 'documentation':
        this.handleDocumentationDecision(card);
        break;
      case 'proposal':
        this.handleProposalDecision(card);
        break;
      case 'review':
        this.handleReviewDecision(card);
        break;
      case 'question':
        this.handleQuestionDecision(card);
        break;
    }
  }

  // ─── Phase 1: Onboarding ─────────────────────────────────────────────────

  private startOnboarding(topic: string): void {
    this.chat.setTopic(topic);
    this.chat.setStep('onboarding');
    this.conversationContext = [topic];

    const analysis = this.analyzeProject();

    const lines: string[] = [
      `안녕하세요! 프로젝트 목표를 함께 정리해 보겠습니다.\n`,
      `**"${topic}"**\n`,
    ];

    if (analysis.hasConfig) {
      lines.push(
        `프로젝트 설정을 찾았습니다:`,
        `- 모델: ${analysis.model ?? '기본값'}`,
        `- 예산: ${analysis.budget ? `$${analysis.budget}` : '제한 없음'}`,
      );
    }

    lines.push(
      `\n자유롭게 대화하면서 목표를 구체화해 주세요.`,
      `기술 스택, 제약사항, 우선순위 등을 말씀해 주시면 좋습니다.`,
      `\n준비가 되면 **"다음"** 또는 **"next"**라고 말씀해 주세요.`,
    );

    this.chat.addMessage('orchestrator', lines.join('\n'));
  }

  private handleOnboardingChat(content: string): void {
    const trimmed = content.trim();
    if (!trimmed) return;

    const lower = trimmed.toLowerCase();

    if (this.isAdvanceCommand(lower)) {
      this.chat.addMessage('orchestrator', `좋습니다! 대화 내용을 분석하여 Output Preview를 생성합니다...`);
      setTimeout(() => this.generatePrediction(), 200);
      return;
    }

    const workflow = this.chat.getWorkflow();
    if (!workflow.topic) {
      const inferredTopic = this.inferTopic(trimmed);
      this.chat.setTopic(inferredTopic);
      this.conversationContext = [inferredTopic, trimmed];
    } else {
      if (this.conversationContext.length === 0) {
        this.conversationContext = [workflow.topic];
      }
      this.conversationContext.push(trimmed);
    }

    const response = this.generateConversationalResponse(trimmed);
    this.chat.addMessage('orchestrator', response);
  }

  private inferTopic(content: string): string {
    const firstLine = content.split('\n').find((l) => l.trim().length > 0)?.trim() ?? content.trim();
    if (firstLine.length <= 64) return firstLine;
    return `${firstLine.slice(0, 61)}...`;
  }

  private getTopicAndRequirements(): { topic: string; requirements: string[] } {
    const workflowTopic = this.chat.getWorkflow().topic.trim();
    const topic = workflowTopic || this.conversationContext[0] || '새 프로젝트';
    const requirements = this.conversationContext.slice(1).filter((c) => c.trim().length > 0);
    return { topic, requirements };
  }

  private isAdvanceCommand(text: string): boolean {
    const commands = ['다음', 'next', '준비', 'ready', '진행', 'proceed'];
    return commands.some(cmd => text.includes(cmd));
  }

  private isStopCommand(text: string): boolean {
    const lower = text.toLowerCase().trim();
    const commands = ['중단', 'stop', '멈춰', '그만', 'abort', 'cancel'];
    return commands.some(cmd => lower.includes(cmd));
  }

  private generateConversationalResponse(content: string): string {
    const msgCount = this.conversationContext.length;

    if (content.includes('?') || content.includes('어떻게') || content.includes('뭐')) {
      return [
        `좋은 질문입니다.\n`,
        `추가로 알고 싶은 내용이 있으시면 말씀해주세요.`,
        `준비가 되면 **"다음"**이라고 말씀해 주세요.`,
      ].join('\n');
    }

    if (msgCount <= 2) {
      return [
        `이해했습니다. 메모했습니다.\n`,
        `더 구체적인 요구사항이 있으신가요?`,
        `예를 들어:`,
        `- 어떤 기술 스택을 사용하시나요?`,
        `- 특별한 제약사항이 있나요?`,
        `- 우선순위가 높은 기능은 무엇인가요?\n`,
        `준비가 되면 **"다음"**이라고 말씀해 주세요.`,
      ].join('\n');
    }

    if (msgCount <= 4) {
      return [
        `좋습니다, 점점 구체화되고 있습니다.\n`,
        `지금까지 파악한 내용:`,
        ...this.conversationContext.map((c, i) => `  ${i + 1}. ${c.substring(0, 80)}`),
        `\n충분히 논의하셨으면 **"다음"**으로 진행하세요.`,
      ].join('\n');
    }

    return [
      `메모했습니다.\n`,
      `지금까지 ${msgCount}개의 메시지를 교환했습니다.`,
      `충분한 정보가 모였다면 **"다음"**이라고 말씀하시면 Output Preview를 생성합니다.`,
    ].join('\n');
  }

  // ─── Phase 2: Prediction (Goal Prediction) ──────────────────────────────

  private generatePrediction(): void {
    this.chat.setStep('prediction');

    const { topic, requirements } = this.getTopicAndRequirements();
    const analysis = this.analyzeProject();

    const previewHtml = buildPredictionHtml({
      topic,
      requirements,
      model: analysis.model ?? 'claude-sonnet-4-6',
      budget: analysis.budget ? `$${analysis.budget}` : '미설정',
    });

    const card = this.chat.createDecision(
      'prediction',
      'Output Preview',
      `프로젝트 "${topic}"의 예측 결과입니다. 이 방향이 맞는지 확인해 주세요.`,
      ['Approve', 'Modify', 'Reject'],
      [{ label: 'Preview', html: previewHtml }],
    );

    this.chat.addMessage('orchestrator',
      `Output Preview를 생성했습니다. 위의 카드를 확인해 주세요.`,
      { decision: card },
    );
  }

  private handlePredictionDecision(card: DecisionCardDTO): void {
    if (card.status === 'approved') {
      this.chat.addMessage('orchestrator', `Output Preview가 승인되었습니다. 개발 문서를 생성합니다...`);
      setTimeout(() => this.generateDocumentation(), 200);
    } else if (card.status === 'modified') {
      this.chat.addMessage('orchestrator',
        `수정 요청을 반영합니다: "${card.response}"\n대화를 통해 목표를 수정할 수 있습니다. 준비되면 "다음"이라고 말씀해 주세요.`);
      this.conversationContext.push(`[수정 요청] ${card.response}`);
      this.chat.setStep('onboarding');
    } else {
      this.chat.addMessage('orchestrator', `Preview가 거부되었습니다. 새 메시지를 보내 다시 시작하세요.`);
      this.resetState();
    }
  }

  // ─── Phase 3: Documentation ──────────────────────────────────────────────

  private generateDocumentation(): void {
    this.chat.setStep('documentation');

    const { topic, requirements } = this.getTopicAndRequirements();

    const tabs = buildDocumentationTabs({ topic, requirements });

    const card = this.chat.createDecision(
      'documentation',
      'Documentation Plan',
      `다음 3개 문서를 생성합니다. 탭을 전환하여 검토 후 승인해 주세요.`,
      ['Approve', 'Modify', 'Reject'],
      tabs,
    );

    this.chat.addMessage('orchestrator',
      `문서 생성 계획을 수립했습니다. 위의 카드를 확인해 주세요.`,
      { decision: card },
    );
  }

  private handleDocumentationDecision(card: DecisionCardDTO): void {
    if (card.status === 'approved') {
      this.chat.addMessage('orchestrator', `문서 생성이 승인되었습니다. 개발을 위한 Bot Team을 제안합니다...`);
      setTimeout(() => this.generateDevelopmentProposal(), 500);
    } else if (card.status === 'modified') {
      this.chat.addMessage('orchestrator',
        `수정 요청을 반영합니다: "${card.response}"\n문서 계획을 재구성합니다.`);
      setTimeout(() => this.generateDocumentation(), 200);
    } else {
      this.chat.addMessage('orchestrator', `문서 생성이 거부되었습니다. 온보딩으로 돌아갑니다.`);
      this.chat.setStep('onboarding');
    }
  }

  // ─── Phase 4: Development ────────────────────────────────────────────────

  private generateDevelopmentProposal(): void {
    this.chat.setStep('development');

    const { topic, requirements } = this.getTopicAndRequirements();

    const taskList = requirements.length > 0
      ? requirements.slice(0, 6).map((r, i) => `  ${i + 1}. ${r.substring(0, 80)}`)
      : ['  1. PRD / TechSpec / Tasks 문서 생성', '  2. 핵심 기능 구현', '  3. 단위 테스트 작성', '  4. 코드 리뷰'];

    const description = [
      `**목표:** ${topic}\n`,
      `**제안 Bot Team:**\n`,
      `1. **developer** (Sonnet) — 코드 구현 담당`,
      `   - 도구: Read, Write, Edit, Bash, Grep, Glob`,
      `   - 역할: 메인 코드 작성`,
      `\n2. **reviewer** (Sonnet) — 코드 리뷰 담당`,
      `   - 도구: Read, Grep, Glob (읽기 전용)`,
      `   - 역할: 코드 품질 검증`,
      `\n**실행 계획:**`,
      ...taskList,
      `\n**예상 실행:**`,
      `- Developer가 Tasks 목록을 순차 실행`,
      `- Reviewer가 완료된 코드를 검증`,
      `- 목표 이탈 감지 시 즉시 알림`,
      `\n개발을 시작할까요?`,
    ].join('\n');

    const card = this.chat.createDecision(
      'proposal',
      'Bot Team Proposal',
      description,
      ['Approve', 'Modify', 'Reject'],
    );

    this.chat.addMessage('orchestrator',
      `Bot Team 제안을 생성했습니다. 위의 카드를 확인해 주세요.`,
      { decision: card },
    );
  }

  private handleProposalDecision(card: DecisionCardDTO): void {
    if (card.status === 'approved') {
      this.startDevelopment();
    } else if (card.status === 'modified') {
      this.chat.addMessage('orchestrator', `수정 요청을 반영합니다: "${card.response}". 재구성 중...`);
      setTimeout(() => this.generateDevelopmentProposal(), 200);
    } else {
      this.chat.addMessage('orchestrator', `제안이 거부되었습니다. 문서 단계로 돌아갑니다.`);
      this.chat.setStep('documentation');
    }
  }

  private startDevelopment(): void {
    const { topic, requirements } = this.getTopicAndRequirements();
    this.devStartedAt = new Date().toISOString();
    this.devResults = [];
    this.stopRequested = false;

    const buildDeveloperTask = (goal: string): string => [
      `현재 워크스페이스에서 다음 요구사항을 실제 코드 변경으로 구현하세요: ${goal}`,
      `질문 없이 합리적 가정으로 진행하고, 필요한 파일을 직접 수정하세요.`,
      `완료 시 변경 파일 목록, 핵심 구현 내용, 수행한 검증(테스트/빌드)을 간결히 보고하세요.`,
    ].join('\n');

    const devTasks = requirements.length > 0
      ? requirements.slice(0, 6).map(buildDeveloperTask)
      : [buildDeveloperTask(`${topic}의 핵심 기능`) ];

    const botSpecs: BotSpec[] = [
      {
        name: 'developer',
        role: 'developer',
        systemPrompt: [
          `당신은 숙련된 개발자입니다.`,
          `프로젝트 목표: ${topic}`,
          `요구사항을 구현 중심으로 처리하고, 확인 질문 없이 실질적인 코드 변경을 완료하세요.`,
        ].join(' '),
        tasks: devTasks,
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
      },
      {
        name: 'reviewer',
        role: 'reviewer',
        systemPrompt: `당신은 코드 리뷰어입니다. 개발된 코드의 품질, 보안, 성능을 검증하세요.`,
        tasks: ['개발된 코드를 리뷰하고 이슈를 보고하세요.'],
        allowedTools: ['Read', 'Grep', 'Glob'],
      },
    ];

    const botNames = botSpecs.map(s => s.name);
    this.chat.setActiveBots(botNames);

    this.chat.addMessage('orchestrator', [
      `**개발을 시작합니다!**\n`,
      `${botNames.length}개의 봇이 작업 중: ${botNames.join(', ')}`,
      `\nDashboard에서 실시간으로 진행 상황을 추적합니다.`,
      `"중단" 또는 "stop"으로 개발을 중단할 수 있습니다.`,
    ].join('\n'));
    this.startDevelopmentHeartbeat();

    if (this.botComposer) {
      void this.runDevelopmentPipeline(botSpecs);
    } else {
      // Simulation fallback (no SDK available)
      this.chat.broadcastBots(botNames.map(name => ({
        name,
        status: 'working' as const,
        costUsd: 0,
        tasksCompleted: 0,
        tasksFailed: 0,
      })));
      setTimeout(() => this.completeDevelopment(botNames, []), 2000);
    }
  }

  private async runDevelopmentPipeline(specs: BotSpec[]): Promise<void> {
    if (!this.botComposer) return;

    if (this.isBudgetExceeded()) {
      this.chat.addMessage('orchestrator', `**예산 한도에 도달했습니다.** 개발을 중단합니다.`);
      this.chat.setStep('review');
      setTimeout(() => this.startReview([]), 200);
      return;
    }

    const bots = this.botComposer.createBotTeam(specs);
    const botNames = bots.map(b => b.spec.name);

    try {
      const results = await this.botComposer.executePipeline(bots);
      this.devResults = results;

      if (this.stopRequested) {
        this.chat.addMessage('orchestrator', `사용자 요청에 의해 개발이 중단되었습니다.`);
      }

      this.recordBotSessions(results);
      this.completeDevelopment(botNames, results);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.chat.addMessage('orchestrator', `**개발 중 오류가 발생했습니다:** ${msg}`);
      this.completeDevelopment(botNames, this.devResults);
    }
  }

  private completeDevelopment(botNames: string[], results: BotTaskResult[]): void {
    this.stopDevelopmentHeartbeat();
    this.chat.setActiveBots([]);

    this.chat.broadcastBots(botNames.map(name => {
      const botResults = results.filter(r => r.botName === name);
      return {
        name,
        status: 'idle' as const,
        costUsd: botResults.reduce((sum, r) => sum + r.costUsd, 0),
        tasksCompleted: botResults.filter(r => r.success).length,
        tasksFailed: botResults.filter(r => !r.success).length,
      };
    }));

    this.chat.addMessage('orchestrator', `개발이 완료되었습니다. 결과를 검토합니다...`);
    setTimeout(() => this.startReview(results), 500);
  }

  private handleStopCommand(): void {
    this.stopRequested = true;
    if (this.botComposer) {
      this.botComposer.abortAll();
    }
    this.chat.addMessage('orchestrator',
      `개발 중단 요청을 처리합니다. 현재 진행 중인 작업이 정리되면 리뷰로 전환합니다.`);
  }

  // ─── Phase 5: Review ─────────────────────────────────────────────────────

  private startReview(results: BotTaskResult[]): void {
    this.stopDevelopmentHeartbeat();
    this.chat.setStep('review');

    const { topic } = this.getTopicAndRequirements();
    const succeeded = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const totalCost = results.reduce((sum, r) => sum + r.costUsd, 0);
    const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);
    const modifiedFiles = this.botComposer?.getModifiedFiles() ?? [];
    const failureReasons = this.collectFailureReasons(failed);

    const reviewHtml = buildReviewHtml({
      topic,
      tasksCompleted: succeeded.length,
      tasksFailed: failed.length,
      totalCostUsd: totalCost,
      durationMs: totalDuration,
      modifiedFiles,
      botSummaries: this.buildBotSummaries(results),
      goals: this.conversationContext.slice(0, 5),
      failureReasons,
    });

    const topReason = failureReasons
      .slice(0, 2)
      .map((f) => (f.errorCode ? `${f.errorCode}(${f.botName})` : `${f.reason.substring(0, 28)}(${f.botName})`))
      .join(', ');

    const description = [
      `**결과 검토 보고서**\n`,
      `**프로젝트:** ${topic}`,
      `**완료:** ${succeeded.length}개 / **실패:** ${failed.length}개`,
      `**비용:** $${totalCost.toFixed(4)}`,
      ...(topReason ? [`**주요 실패 원인:** ${topReason}`] : []),
      `\n최종 결과를 승인하시겠습니까?`,
    ].join('\n');

    const card = this.chat.createDecision(
      'review',
      'Review Report',
      description,
      ['Approve', 'Reject'],
      [{ label: 'Report', html: reviewHtml }],
    );

    this.chat.addMessage('orchestrator',
      `결과 검토 보고서를 생성했습니다. 위의 카드를 확인해 주세요.`,
      { decision: card },
    );
  }

  private handleReviewDecision(card: DecisionCardDTO): void {
    if (card.status === 'approved') {
      this.completeWorkflow();
    } else {
      this.chat.addMessage('orchestrator',
        `리뷰가 거부되었습니다. 개발 단계로 돌아가 수정합니다.`);
      this.chat.setStep('development');
      setTimeout(() => this.generateDevelopmentProposal(), 200);
    }
  }

  // ─── Completion + Epic Cycle ─────────────────────────────────────────────

  private completeWorkflow(): void {
    this.stopDevelopmentHeartbeat();
    this.chat.setStep('completed');
    this.chat.setActiveBots([]);

    const { topic } = this.getTopicAndRequirements();
    const epicNumber = this.chat.getEpicNumber() + 1;
    const totalCost = this.botComposer?.getTotalCost() ?? 0;
    const totalDuration = this.devStartedAt
      ? Date.now() - new Date(this.devStartedAt).getTime()
      : 0;
    const modifiedFiles = this.botComposer?.getModifiedFiles() ?? [];
    const succeeded = this.devResults.filter(r => r.success).length;
    const failed = this.devResults.filter(r => !r.success).length;
    const botNames = [...new Set(this.devResults.map(r => r.botName))];

    const epicSummary: EpicSummary = {
      epicNumber,
      topic,
      startedAt: this.devStartedAt ?? new Date().toISOString(),
      completedAt: new Date().toISOString(),
      totalCostUsd: totalCost,
      durationMs: totalDuration,
      tasksCompleted: succeeded,
      tasksFailed: failed,
      botNames,
      modifiedFiles,
    };

    this.chat.completeEpic(epicSummary);

    this.chat.addMessage('orchestrator', [
      `**Epic #${epicNumber} 완료!**\n`,
      `**주제:** ${topic}`,
      `**완료:** ${succeeded}개 / **실패:** ${failed}개`,
      `**비용:** $${totalCost.toFixed(4)}`,
      `**소요 시간:** ${this.formatDuration(totalDuration)}`,
    ].join('\n'));

    const workflow = this.chat.getWorkflow();
    if (workflow.autoOnboarding) {
      this.suggestNextEpics(true);
    } else {
      this.suggestNextEpics(false);
    }
  }

  private suggestNextEpics(autoSelect: boolean): void {
    const suggestions = this.generateEpicSuggestions();

    if (autoSelect && suggestions.length > 0) {
      if (this.isBudgetExceeded()) {
        this.chat.addMessage('orchestrator',
          `**Auto-Pilot 중단:** 예산 한도에 도달했습니다. 수동으로 다음 Epic을 선택해 주세요.`);
        this.chat.setAutoOnboarding(false);
        this.showNextEpicDecision(suggestions);
        return;
      }

      this.chat.addMessage('orchestrator',
        `**Auto-Pilot:** 다음 Epic을 자동으로 시작합니다 → "${suggestions[0]}"`);
      setTimeout(() => this.startNextEpic(suggestions[0]), 500);
      return;
    }

    this.showNextEpicDecision(suggestions);
  }

  private showNextEpicDecision(suggestions: string[]): void {
    if (suggestions.length === 0) {
      this.chat.addMessage('orchestrator',
        `다음 Epic 후보를 찾지 못했습니다. 새 주제를 입력하거나 Reset으로 새 워크플로우를 시작할 수 있습니다.`);
      return;
    }

    const card = this.chat.createDecision(
      'question',
      'Next Epic',
      `다음으로 진행할 Epic을 선택해 주세요.\n\n` +
        suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n') +
        `\n\n또는 "Reset"으로 새 워크플로우를 시작할 수 있습니다.`,
      suggestions.slice(0, 3),
    );

    this.chat.addMessage('orchestrator',
      `다음 Epic 후보를 생성했습니다. 위의 카드에서 선택해 주세요.`,
      { decision: card },
    );
  }

  private handleQuestionDecision(card: DecisionCardDTO): void {
    if (card.status === 'approved' && card.response) {
      this.startNextEpic(card.response);
    } else if (card.status === 'rejected') {
      this.chat.addMessage('orchestrator',
        `워크플로우가 완료되었습니다. Reset 버튼으로 새 워크플로우를 시작할 수 있습니다.`);
    }
  }

  private startNextEpic(topic: string): void {
    this.stopDevelopmentHeartbeat();
    this.chat.resetForNextEpic();
    this.conversationContext = [];
    this.devResults = [];
    this.devStartedAt = null;
    this.stopRequested = false;

    this.botComposer?.reset();

    this.chat.addMessage('orchestrator', [
      `**새 Epic을 시작합니다!**\n`,
      `**주제:** ${topic}\n`,
      `자유롭게 대화하면서 목표를 구체화해 주세요.`,
      `준비가 되면 **"다음"**이라고 말씀해 주세요.`,
    ].join('\n'));

    this.chat.setTopic(topic);
    this.conversationContext = [topic];
  }

  private handleCompletedChat(content: string): void {
    const lower = content.toLowerCase().trim();

    if (this.isAdvanceCommand(lower) || lower.length > 10) {
      this.startNextEpic(content);
      return;
    }

    this.chat.addMessage('orchestrator',
      `워크플로우가 완료되었습니다. 새 주제를 입력하면 다음 Epic을 시작합니다. 또는 Reset 버튼으로 초기화할 수 있습니다.`);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private resetState(): void {
    this.stopDevelopmentHeartbeat();
    this.conversationContext = [];
    this.devResults = [];
    this.devStartedAt = null;
    this.stopRequested = false;
    this.chat.setTopic('');
    this.chat.setStep('idle');
  }

  private analyzeProject(): ProjectAnalysis {
    if (!this.projectPath) {
      return { hasConfig: false, model: undefined, budget: undefined };
    }

    const config = readConfig(this.projectPath);
    return {
      hasConfig: config !== null,
      model: config?.model,
      budget: config?.maxTotalBudgetUsd,
    };
  }

  private isBudgetExceeded(): boolean {
    const analysis = this.analyzeProject();
    if (!analysis.budget) return false;

    const totalCost = this.sessionManager?.getTotalCost() ?? 0;
    return totalCost >= analysis.budget;
  }

  private recordBotSessions(results: BotTaskResult[]): void {
    if (!this.sessionManager) return;

    for (const r of results) {
      const failure = this.extractFailureInsight(r);
      this.sessionManager.addRecord({
        sessionId: r.sessionId ?? `sim-${Date.now()}`,
        prompt: r.task.substring(0, 200),
        costUsd: r.costUsd,
        durationMs: r.durationMs,
        success: r.success,
        timestamp: new Date().toISOString(),
        phase: 'development',
        botName: r.botName,
        errorCode: failure.errorCode,
        failureReason: failure.reason,
      });
    }
  }

  private extractFailureInsight(result: BotTaskResult): { errorCode?: string; reason?: string } {
    if (result.success) return {};

    const normalized = result.errors
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    let errorCode: string | undefined;
    const fromSubtype = normalized.find((e) => e.startsWith('subtype='));
    if (fromSubtype) errorCode = fromSubtype.slice('subtype='.length);

    if (!errorCode) {
      const fromResult = /^Task failed:\s*(.+)$/i.exec(result.result.trim());
      if (fromResult && fromResult[1]) errorCode = fromResult[1].trim();
    }

    if (!errorCode) {
      const fromCode = normalized.find((e) => e.startsWith('code='));
      if (fromCode) errorCode = fromCode.slice('code='.length);
    }

    const reason = normalized.find((e) =>
      !e.startsWith('subtype=') &&
      !e.startsWith('code=') &&
      !e.startsWith('exitCode=') &&
      !e.startsWith('signal=') &&
      !e.startsWith('hint='),
    );

    const fallbackReason = result.result.trim();
    const finalReason = (reason || fallbackReason).substring(0, 240);

    return { errorCode, reason: finalReason };
  }

  private collectFailureReasons(failedResults: BotTaskResult[]): Array<{ botName: string; task: string; reason: string; errorCode?: string }> {
    const items = failedResults.map((r) => {
      const failure = this.extractFailureInsight(r);
      return {
        botName: r.botName,
        task: r.task,
        reason: failure.reason ?? '원인 정보 없음',
        errorCode: failure.errorCode,
      };
    });

    const deduped = new Map<string, { botName: string; task: string; reason: string; errorCode?: string }>();
    for (const it of items) {
      const key = `${it.botName}|${it.errorCode ?? ''}|${it.reason}`;
      if (!deduped.has(key)) deduped.set(key, it);
    }
    return Array.from(deduped.values());
  }

  private buildBotSummaries(results: BotTaskResult[]): Array<{ name: string; tasks: number; cost: number; status: string }> {
    const map = new Map<string, { tasks: number; cost: number; ok: number; fail: number }>();
    for (const r of results) {
      const entry = map.get(r.botName) ?? { tasks: 0, cost: 0, ok: 0, fail: 0 };
      entry.tasks++;
      entry.cost += r.costUsd;
      if (r.success) entry.ok++;
      else entry.fail++;
      map.set(r.botName, entry);
    }

    return Array.from(map.entries()).map(([name, s]) => ({
      name,
      tasks: s.tasks,
      cost: s.cost,
      status: s.fail > 0 ? `${s.ok}/${s.tasks} 완료` : '전체 완료',
    }));
  }

  private generateEpicSuggestions(): string[] {
    if (!this.projectPath) return [];

    const suggestions: string[] = [];

    const docs = scanDocsFolder(this.projectPath);
    const agentsMd = readAgentsMd(this.projectPath);

    if (docs) {
      for (const [name, content] of Object.entries(docs)) {
        const todoLines = content.split('\n').filter(l =>
          l.includes('TODO') || l.includes('- [ ]'),
        );
        if (todoLines.length > 0) {
          suggestions.push(`${name}의 미완료 항목 구현`);
        }
      }
    }

    if (agentsMd && suggestions.length < 3) {
      suggestions.push('코드 리팩토링 및 최적화');
    }

    if (suggestions.length < 3) {
      suggestions.push('테스트 코드 작성');
    }

    return suggestions.slice(0, 3);
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}초`;
    const min = Math.floor(sec / 60);
    const remainSec = sec % 60;
    return `${min}분 ${remainSec}초`;
  }

  private startDevelopmentHeartbeat(): void {
    this.stopDevelopmentHeartbeat();

    const intervalMs = this.getDevelopmentHeartbeatIntervalMs();
    this.devHeartbeatTimer = setInterval(() => {
      const workflow = this.chat.getWorkflow();
      if (workflow.step !== 'development') {
        this.stopDevelopmentHeartbeat();
        return;
      }

      const elapsedMs = this.devStartedAt
        ? Math.max(0, Date.now() - new Date(this.devStartedAt).getTime())
        : 0;
      const cost = this.botComposer?.getTotalCost() ?? 0;
      const summaryFromComposer = this.botComposer
        ? this.botComposer
          .getAllBots()
          .map((b) => `${b.spec.name}:${b.status.status}`)
          .join(', ')
        : '';
      const summary = summaryFromComposer || (workflow.activeBots.length > 0 ? workflow.activeBots.join(', ') : '없음');

      this.chat.addMessage(
        'orchestrator',
        `개발 진행 중입니다. 경과 ${this.formatDuration(elapsedMs)}, 비용 $${cost.toFixed(4)}, 봇 상태: ${summary}`,
      );
    }, intervalMs);
  }

  private stopDevelopmentHeartbeat(): void {
    if (!this.devHeartbeatTimer) return;
    clearInterval(this.devHeartbeatTimer);
    this.devHeartbeatTimer = null;
  }

  private getDevelopmentHeartbeatIntervalMs(): number {
    const fallback = 45_000;
    if (!this.projectPath) return fallback;

    const cfg = readConfig(this.projectPath);
    const raw = cfg?.developmentHeartbeatIntervalMs;
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return fallback;
    return Math.floor(raw);
  }
}

interface ProjectAnalysis {
  hasConfig: boolean;
  model: string | undefined;
  budget: number | undefined;
}

interface ProjectContext {
  agentsMd: string | null;
  docs: Record<string, string> | null;
  config: Partial<import('../../shared/types.js').ClaudeBotConfig> | null;
}
