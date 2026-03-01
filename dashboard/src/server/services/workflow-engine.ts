import type { ChatManager } from './chat-manager.js';
import type { DecisionCardDTO } from '../../shared/api-types.js';
import { readConfig, readTasks } from './file-reader.js';

/**
 * WorkflowEngine — PRD 기반 4-Step Orchestrator
 *
 * PRD 시나리오:
 *   Step 1 (Onboarding): 자유 대화 기반 브레인스토밍 → 사용자가 "준비됐다"고 할 때까지 대화
 *   Step 2 (Preview): Output Preview 제시 → 사용자 승인/수정/거부
 *   Step 3 (Proposal): Bot Team 제안 → 사용자 승인/수정/거부
 *   Step 4 (Execution): 봇 실행 + 결과 보고서
 *
 * 핵심 원칙: 자동 전환 금지. 모든 단계 전환은 사용자의 명시적 의사에 의함.
 */
export class WorkflowEngine {
  private chat: ChatManager;
  private projectPath: string | null = null;
  private conversationContext: string[] = []; // onboarding 동안 쌓이는 대화

  constructor(chat: ChatManager) {
    this.chat = chat;
  }

  setProjectPath(projectPath: string): void {
    this.projectPath = projectPath;
  }

  /**
   * Handle user message — 현재 step에 따라 다르게 처리
   */
  handleUserMessage(content: string): void {
    const workflow = this.chat.getWorkflow();

    switch (workflow.step) {
      case 'idle':
        this.startOnboarding(content);
        break;
      case 'onboarding':
        this.handleOnboardingChat(content);
        break;
      case 'preview':
        this.chat.addMessage('orchestrator',
          `위의 Output Preview에 대한 결정을 내려주세요. (Approve / Modify / Reject)`);
        break;
      case 'proposal':
        this.chat.addMessage('orchestrator',
          `위의 Bot Team 제안에 대한 결정을 내려주세요. (Approve / Modify / Reject)`);
        break;
      case 'execution':
        this.chat.addMessage('orchestrator',
          `봇이 작업 중입니다. 완료되면 알려드리겠습니다.`);
        break;
      case 'completed':
        this.chat.addMessage('orchestrator',
          `이 워크플로우는 완료되었습니다. Reset 버튼으로 새로운 워크플로우를 시작할 수 있습니다.`);
        break;
    }
  }

  /**
   * Handle decision resolution
   */
  handleDecisionResolved(card: DecisionCardDTO): void {
    if (card.type === 'preview') {
      this.handlePreviewDecision(card);
    } else if (card.type === 'proposal') {
      this.handleProposalDecision(card);
    }
  }

  // ─── Step 1: Onboarding — 자유 대화 기반 ──────────────────────────────

  private startOnboarding(topic: string): void {
    this.chat.setTopic(topic);
    this.chat.setStep('onboarding');
    this.conversationContext = [topic];

    const analysis = this.analyzeProject(topic);

    const lines: string[] = [
      `안녕하세요! 프로젝트 목표를 분석하겠습니다.\n`,
      `**"${topic}"**\n`,
    ];

    if (analysis.hasConfig) {
      lines.push(`프로젝트 설정을 찾았습니다:`,
        `- 엔진: ${analysis.engine}`,
        `- 예산: ${analysis.budget ? `$${analysis.budget}` : '제한 없음'}`);
    }

    if (analysis.hasTasksFile && analysis.taskCount > 0) {
      lines.push(`\n기존 작업 ${analysis.taskCount}개를 발견했습니다:`);
      lines.push(analysis.taskSummary);
    }

    lines.push(
      `\n자유롭게 대화하면서 목표를 구체화해 주세요.`,
      `준비가 되면 **"미리보기"** 또는 **"preview"**라고 말씀해 주세요.`,
    );

    this.chat.addMessage('orchestrator', lines.join('\n'));
  }

  private handleOnboardingChat(content: string): void {
    this.conversationContext.push(content);
    const lower = content.toLowerCase().trim();

    // 명시적으로 다음 단계로 전환 요청
    if (this.isAdvanceCommand(lower)) {
      const analysis = this.analyzeProject(this.chat.getWorkflow().topic);
      this.chat.addMessage('orchestrator', `좋습니다! 지금까지의 대화를 바탕으로 Output Preview를 생성합니다...`);
      setTimeout(() => this.generatePreview(analysis), 200);
      return;
    }

    // 자유 대화 응답 — 프로젝트 분석 기반 맥락적 답변
    const response = this.generateConversationalResponse(content);
    this.chat.addMessage('orchestrator', response);
  }

  private isAdvanceCommand(text: string): boolean {
    const commands = [
      '미리보기', 'preview', '다음', 'next', '준비', 'ready',
      '진행', 'proceed', 'go', '시작', 'start',
    ];
    return commands.some(cmd => text.includes(cmd));
  }

  private generateConversationalResponse(content: string): string {
    const analysis = this.analyzeProject(this.chat.getWorkflow().topic);
    const msgCount = this.conversationContext.length;

    // 맥락에 따라 다양한 응답 생성
    if (content.includes('?') || content.includes('어떻게') || content.includes('뭐')) {
      return [
        `좋은 질문입니다.\n`,
        analysis.hasTasksFile
          ? `현재 프로젝트에는 ${analysis.taskCount}개의 작업이 정의되어 있습니다.`
          : `아직 작업 파일이 없습니다. 목표를 더 구체적으로 설명해주시면 작업을 구성할 수 있습니다.`,
        `\n추가로 알고 싶은 내용이 있으시면 말씀해주세요.`,
        `준비가 되면 **"미리보기"**라고 말씀해 주세요.`,
      ].join('\n');
    }

    if (msgCount <= 2) {
      return [
        `이해했습니다. "${content}"에 대해 메모했습니다.\n`,
        `더 구체적인 요구사항이 있으신가요?`,
        `예를 들어:`,
        `- 어떤 기술 스택을 사용하시나요?`,
        `- 특별한 제약사항이 있나요?`,
        `- 우선순위가 높은 기능은 무엇인가요?\n`,
        `준비가 되면 **"미리보기"**라고 말씀해 주세요.`,
      ].join('\n');
    }

    if (msgCount <= 4) {
      return [
        `좋습니다, 점점 구체화되고 있습니다.\n`,
        `지금까지 파악한 내용:`,
        ...this.conversationContext.map((c, i) => `  ${i + 1}. ${c.substring(0, 60)}`),
        `\n충분히 논의하셨으면 **"미리보기"**로 다음 단계로 진행하세요.`,
      ].join('\n');
    }

    return [
      `메모했습니다.\n`,
      `지금까지 ${msgCount}개의 메시지를 교환했습니다.`,
      `충분한 정보가 모였다면 **"미리보기"**라고 말씀하시면 Output Preview를 생성합니다.`,
    ].join('\n');
  }

  // ─── Step 2: Output Preview ──────────────────────────────────────────

  private generatePreview(analysis: ProjectAnalysis): void {
    this.chat.setStep('preview');

    const topic = this.chat.getWorkflow().topic;
    const estimatedCost = Math.max(analysis.taskCount, 1) * 0.15;
    const estimatedTurns = Math.max(analysis.taskCount, 1) * 8;

    const contextSummary = this.conversationContext.length > 1
      ? `\n**대화에서 수집된 요구사항:**\n${this.conversationContext.slice(1).map((c, i) => `  ${i + 1}. ${c.substring(0, 80)}`).join('\n')}`
      : '';

    const description = [
      `**프로젝트:** ${topic}\n`,
      `**예상 범위:**`,
      `- 작업 수: ${analysis.taskCount || 'TBD'}`,
      `- 예상 비용: ~$${estimatedCost.toFixed(2)}`,
      `- 예상 턴 수: ~${estimatedTurns}`,
      `- 엔진: ${analysis.engine}`,
      contextSummary,
      analysis.taskCount > 0
        ? `\n**실행할 작업:**\n${analysis.taskSummary}`
        : `\n**목표:** ${topic}`,
    ].join('\n');

    const card = this.chat.createDecision(
      'preview',
      'Output Preview',
      description,
      ['Approve', 'Modify', 'Reject'],
    );

    this.chat.addMessage('orchestrator',
      `Output Preview를 생성했습니다. 위의 카드를 확인해 주세요.`,
      { decision: card },
    );
  }

  private handlePreviewDecision(card: DecisionCardDTO): void {
    if (card.status === 'approved') {
      this.chat.addMessage('orchestrator', `Output Preview가 승인되었습니다. Bot Team을 구성합니다...`);
      setTimeout(() => this.generateProposal(), 200);
    } else if (card.status === 'modified') {
      this.chat.addMessage('orchestrator',
        `수정 요청을 반영합니다: "${card.response}"\n다시 대화를 통해 목표를 수정할 수 있습니다. 준비되면 "미리보기"라고 말씀해 주세요.`);
      this.conversationContext.push(`[수정 요청] ${card.response}`);
      this.chat.setStep('onboarding');
    } else {
      this.chat.addMessage('orchestrator', `Preview가 거부되었습니다. 새 메시지를 보내 다시 시작하세요.`);
      this.conversationContext = [];
      this.chat.setStep('idle');
    }
  }

  // ─── Step 3: Bot Proposal ────────────────────────────────────────────

  private generateProposal(): void {
    this.chat.setStep('proposal');

    const analysis = this.analyzeProject(this.chat.getWorkflow().topic);
    const botCount = Math.max(1, Math.min(analysis.taskCount || 1, 3));

    const botNames: string[] = [];
    const lines: string[] = ['**제안 Bot Team:**\n'];

    if (botCount >= 1) {
      botNames.push('developer');
      lines.push(`1. **developer** — Sonnet, 코드 구현 담당`);
    }
    if (botCount >= 2) {
      botNames.push('reviewer');
      lines.push(`2. **reviewer** — Sonnet, 코드 리뷰 및 테스트`);
    }
    if (botCount >= 3) {
      botNames.push('writer');
      lines.push(`3. **writer** — Haiku, 문서 작성`);
    }

    lines.push('', `봇 수: ${botCount}`, `통신: ${botNames.join(' <-> ')}`);

    const card = this.chat.createDecision(
      'proposal',
      'Bot Team Proposal',
      lines.join('\n'),
      ['Approve', 'Modify', 'Reject'],
    );

    this.chat.addMessage('orchestrator',
      `Bot Team 제안을 생성했습니다. 위의 카드를 확인해 주세요.`,
      { decision: card },
    );
  }

  private handleProposalDecision(card: DecisionCardDTO): void {
    if (card.status === 'approved') {
      this.startExecution();
    } else if (card.status === 'modified') {
      this.chat.addMessage('orchestrator', `수정 요청을 반영합니다: "${card.response}". 재구성 중...`);
      setTimeout(() => this.generateProposal(), 200);
    } else {
      this.chat.addMessage('orchestrator', `제안이 거부되었습니다. 새 메시지를 보내 다시 시작하세요.`);
      this.conversationContext = [];
      this.chat.setStep('idle');
    }
  }

  // ─── Step 4: Execution ───────────────────────────────────────────────

  private startExecution(): void {
    this.chat.setStep('execution');

    const analysis = this.analyzeProject(this.chat.getWorkflow().topic);
    const botCount = Math.max(1, Math.min(analysis.taskCount || 1, 3));
    const botNames = ['developer', 'reviewer', 'writer'].slice(0, botCount);
    this.chat.setActiveBots(botNames);

    this.chat.broadcastBots(botNames.map(name => ({
      name,
      status: 'working' as const,
      costUsd: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
    })));

    this.chat.addMessage('orchestrator', [
      `**실행을 시작합니다!**\n`,
      `${botCount}개의 봇 생성: ${botNames.join(', ')}`,
      `\nCLI에서 실제 스웜을 실행하려면:`,
      '```',
      `npx claudebot swarm --config claudebot.swarm.json`,
      '```',
      `\n대시보드에서 실시간으로 진행 상황을 추적합니다.`,
    ].join('\n'));

    // Simulate completion (실제 환경에서는 EventBus가 트리거)
    setTimeout(() => this.completeExecution(botNames), 2000);
  }

  private completeExecution(botNames: string[]): void {
    this.chat.setStep('completed');

    this.chat.broadcastBots(botNames.map(name => ({
      name,
      status: 'idle' as const,
      costUsd: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
    })));
    this.chat.setActiveBots([]);

    this.chat.addMessage('orchestrator', [
      `**워크플로우 완료!**\n`,
      `결과 확인:`,
      `- [HTML 보고서](/api/report)`,
      `- [대시보드](/)`,
      `\nReset으로 새 워크플로우를 시작할 수 있습니다.`,
    ].join('\n'));
  }

  // ─── Project Analysis ────────────────────────────────────────────────

  private analyzeProject(_topic: string): ProjectAnalysis {
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
      taskSummary: taskSummary || '(없음)',
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
