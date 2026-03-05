import type { ChatManager } from './chat-manager.js';
import type { BotComposer, BotSpec, BotTaskResult } from './bot-composer.js';
import type { MessageQueue } from './message-queue.js';
import type { SessionManager } from './session-manager.js';
import type { IExecutor, ExecutorConfig, TaskResult } from './executor-types.js';
import type { DecisionCardDTO, EpicSummary } from '../../shared/api-types.js';
import fs from 'node:fs';
import path from 'node:path';
import { buildExecutorConfig } from './executor-config.js';
import { readConfig, readAgentsMd, scanDocsFolder } from './file-reader.js';
import { savePreviewHtml } from './preview-store.js';
import {
  buildPredictionArtifactHtml, buildDocumentationTabs, buildReviewHtml,
  buildReviewArtifactHtml,
  type PredictionSnapshot, type RequirementCheckResult,
} from './html-preview.js';

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
  private executor: IExecutor | null = null;
  private botComposer: BotComposer | null = null;
  private messageQueue: MessageQueue | null = null;
  private sessionManager: SessionManager | null = null;
  private projectPath: string | null = null;
  private conversationContext: string[] = [];
  private projectContext: ProjectContext | null = null;

  // Documentation state — persists between phases so development can reference it
  private lastDocDraft: DocumentationDraft | null = null;

  // Prediction state — kept for review cross-reference
  private lastPredictionDraft: PredictionDraft | null = null;

  // Development state
  private devStartedAt: string | null = null;
  private devResults: BotTaskResult[] = [];
  private stopRequested = false;
  private devHeartbeatTimer: NodeJS.Timeout | null = null;
  private onboardingReplyQueue: Promise<void> = Promise.resolve();

  constructor(chat: ChatManager) {
    this.chat = chat;
  }

  // ─── Dependency Injection ────────────────────────────────────────────────

  setBotComposer(composer: BotComposer): void {
    this.botComposer = composer;
  }

  setExecutor(executor: IExecutor): void {
    this.executor = executor;
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
    this.onboardingReplyQueue = Promise.resolve();
    this.projectContext = null;
    this.lastDocDraft = null;
    this.lastPredictionDraft = null;
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

    // Accept natural-language decision intents (e.g. "승인", "수정", "거절")
    // when a pending decision exists, so users can continue via chat input.
    if (this.tryResolvePendingDecisionFromChat(content)) {
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

  private tryResolvePendingDecisionFromChat(content: string): boolean {
    const pending = this.chat.getPendingDecisions();
    if (pending.length === 0) return false;

    const intent = this.parseDecisionIntent(content);
    if (!intent) return false;

    const target = pending[pending.length - 1];
    if (intent.status === 'modified' && !intent.response) {
      this.chat.addMessage(
        'orchestrator',
        `수정 의견을 한 줄로 알려주세요. 예: "수정: 버튼 배치를 좌측 정렬로 변경"`,
      );
      return true;
    }

    const resolved = this.chat.resolveDecision(target.id, intent.status, intent.response);
    if (!resolved) return false;

    this.handleDecisionResolved(resolved);
    return true;
  }

  private parseDecisionIntent(
    content: string,
  ): { status: 'approved' | 'rejected' | 'modified'; response?: string } | null {
    const trimmed = content.trim();
    if (!trimmed) return null;

    const normalized = trimmed.toLowerCase();

    const hasAny = (keywords: string[]): boolean => keywords.some((k) => normalized.includes(k));
    const startsWithAny = (keywords: string[]): boolean => keywords.some((k) => normalized.startsWith(k));

    const approveKeywords = ['approve', 'approved', '승인', '동의', 'ok', 'okay', '좋아', '좋습니다', '진행', 'go'];
    const rejectKeywords = ['reject', 'rejected', '거절', '반려', '취소', 'no', '아니요', '아니오'];
    const modifyKeywords = ['modify', 'modified', '수정', '변경', '보완', 'revise', 'feedback', '피드백'];

    if (hasAny(modifyKeywords)) {
      const response = trimmed.replace(
        /^(modify|modified|수정|변경|보완|revise|feedback|피드백)\s*[:\-]?\s*/i,
        '',
      ).trim();
      return {
        status: 'modified',
        response: response.length > 0 ? response : undefined,
      };
    }

    // Prefer explicit reject phrases first for short replies like "no".
    if (hasAny(rejectKeywords) || startsWithAny(['거절', '반려'])) {
      return { status: 'rejected' };
    }

    if (hasAny(approveKeywords) || startsWithAny(['승인'])) {
      return { status: 'approved' };
    }

    return null;
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
      `\n정보가 충분하면 **"preview 생성"** 또는 **"다음"**으로 예측 결과를 만들 수 있습니다.`,
    );

    this.chat.addMessage('orchestrator', lines.join('\n'));
  }

  private handleOnboardingChat(content: string): void {
    const trimmed = content.trim();
    if (!trimmed) return;

    const lower = trimmed.toLowerCase();

    if (this.isAdvanceCommand(lower)) {
      this.chat.addMessage('orchestrator', `좋습니다! 대화 내용을 분석하여 Output Preview를 생성합니다...`);
      setTimeout(() => {
        void this.generatePrediction();
      }, 200);
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

    // A bare numeric answer like "2" usually means option selection.
    // Handle it deterministically to avoid repetitive follow-up questions.
    if (this.extractNumericSelection(trimmed)) {
      this.chat.addMessage('orchestrator', this.buildCompactOnboardingReply(trimmed));
      return;
    }

    this.onboardingReplyQueue = this.onboardingReplyQueue
      .then(async () => {
        let response = await this.generateConversationalResponse(trimmed);
        if (this.shouldUseCompactOnboardingReply(response)) {
          response = this.buildCompactOnboardingReply(trimmed);
        }
        if (this.chat.getWorkflow().step === 'onboarding') {
          this.chat.addMessage('orchestrator', response);
        }
      })
      .catch((error) => {
        const msg = error instanceof Error ? error.message : String(error);
        this.chat.addMessage('orchestrator', `실시간 응답 생성 중 오류가 발생했습니다: ${msg}`);
      });
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
    const commands = ['다음', 'next', '준비', 'ready', '진행', 'proceed', 'preview', 'preview 생성', '미리보기'];
    return commands.some(cmd => text.includes(cmd));
  }

  private isStopCommand(text: string): boolean {
    const lower = text.toLowerCase().trim();
    const commands = ['중단', 'stop', '멈춰', '그만', 'abort', 'cancel'];
    return commands.some(cmd => lower.includes(cmd));
  }

  private async generateConversationalResponse(content: string): Promise<string> {
    if (!this.executor) {
      return this.generateTemplateConversationalResponse(content);
    }

    const { topic } = this.getTopicAndRequirements();
    const recentContext = this.conversationContext.slice(-8).map((line, idx) => `${idx + 1}. ${line}`).join('\n');
    const projectContext = this.buildProjectContextPrompt();

    const prompt = [
      '당신은 ClaudeBot 오케스트레이터입니다.',
      '현재 단계는 onboarding이며 목표를 선명하게 만드는 대화를 진행합니다.',
      `현재 topic: ${topic}`,
      projectContext,
      '응답 규칙:',
      '- 한국어로 응답한다.',
      '- 사용자의 최신 메시지를 반영한다.',
      '- 답변 첫 문장에서 사용자의 최신 입력을 1문장으로 요약해 반영한다.',
      '- 직전 오케스트레이터 질문과 중복되는 질문을 반복하지 않는다.',
      '- 사용자가 "1", "2", "1번"처럼 짧게 답하면 해당 선택을 확정해 요약하고 새로운 질문은 최대 1개만 한다.',
      '- 필요한 경우에만 짧은 확인 질문을 최대 2개까지 포함한다.',
      '- 진행 신호 문구("다음", "진행" 등)는 필요할 때만 간결하게 제시한다.',
      '',
      '[최근 대화]',
      recentContext || '(없음)',
      '',
      '[사용자 최신 메시지]',
      content,
    ].join('\n');

    const result = await this.executeOrchestratorTask(prompt, {
      maxTurnsPerTask: 2,
      taskTimeoutMs: Math.min(this.getBaseExecutorConfig().taskTimeoutMs, 120_000),
      maxBudgetPerTaskUsd: 0.15,
      allowedTools: [],
    });

    if (!result.success) {
      const reason = result.errors[0] ?? result.result;
      return `응답 생성에 실패했습니다. (${reason})\n핵심 요구사항을 한 줄로 다시 알려주세요.`;
    }

    const text = this.sanitizeModelText(result.result);
    return text.length > 0 ? text : '진행할 정보를 더 알려주세요.';
  }

  // ─── Phase 2: Prediction (Goal Prediction) ──────────────────────────────

  private async generatePrediction(): Promise<void> {
    this.chat.setStep('prediction');

    const { topic, requirements } = this.getTopicAndRequirements();
    const analysis = this.analyzeProject();
    const draft = this.executor ? await this.generatePredictionDraft(topic, requirements) : null;
    if (draft) this.lastPredictionDraft = draft;

    if (this.executor && !draft) {
      this.chat.addMessage(
        'orchestrator',
        'Output Preview 생성에 실패했습니다. 입력 의도를 더 구체화해 다시 시도해 주세요.',
      );
      this.chat.setStep('onboarding');
      return;
    }

    const fallbackHtml = buildPredictionArtifactHtml({
      topic,
      requirements: draft?.requirements ?? requirements,
      model: analysis.model ?? 'claude-sonnet-4-6',
      budget: analysis.budget ? `$${analysis.budget}` : '미설정',
      architecture: draft?.architecture,
      userFlow: draft?.userFlow,
      completionCriteria: draft?.completionCriteria,
    });

    const externalArtifact = this.executor
      ? await this.generatePredictionArtifactWithOpus(
        topic,
        draft?.requirements ?? requirements,
        draft?.architecture ?? [],
        draft?.userFlow ?? [],
        draft?.completionCriteria ?? [],
      )
      : null;

    if (!this.projectPath) {
      this.chat.addMessage('orchestrator', '프로젝트 경로를 찾지 못해 Preview 파일을 생성할 수 없습니다.');
      this.chat.setStep('onboarding');
      return;
    }

    const finalHtml = externalArtifact?.html ?? fallbackHtml;
    const preview = savePreviewHtml(this.projectPath, finalHtml, 'prediction');
    const previewUrl = `/api/preview/${preview.id}`;
    const modelUsed = externalArtifact?.model ?? (analysis.model ?? 'claude-sonnet-4-6');
    const summary = externalArtifact?.summary
      || draft?.summary
      || `프로젝트 "${topic}"의 예측 결과를 외부 Preview 링크로 생성했습니다.`;

    const card = this.chat.createDecision(
      'prediction',
      'Output Preview',
      `${summary}\n\n외부 미리보기 링크: ${previewUrl}\n(새 브라우저 탭에서 열어 UI/UX, 아키텍처, DFD, 시나리오를 검토하세요.)`,
      ['Approve', 'Modify', 'Reject'],
    );

    this.chat.addMessage(
      'orchestrator',
      `Output Preview artifact를 생성했습니다.\n- 링크: ${previewUrl}\n- 생성 모델: ${modelUsed}\n링크를 새 탭으로 열어 실제 예상 결과물을 확인해 주세요.`,
      { decision: card },
    );
  }

  private handlePredictionDecision(card: DecisionCardDTO): void {
    if (card.status === 'approved') {
      this.chat.addMessage('orchestrator', `Output Preview가 승인되었습니다. 개발 문서를 생성합니다...`);
      setTimeout(() => {
        void this.generateDocumentation();
      }, 200);
    } else if (card.status === 'modified') {
      this.chat.addMessage('orchestrator',
        `수정 요청을 반영합니다: "${card.response}"\n대화를 이어서 목표를 조정한 뒤 다시 Preview를 생성하겠습니다.`);
      this.conversationContext.push(`[수정 요청] ${card.response}`);
      this.chat.setStep('onboarding');
    } else {
      this.chat.addMessage('orchestrator', `Preview가 거부되었습니다. 새 메시지를 보내 다시 시작하세요.`);
      this.resetState();
    }
  }

  // ─── Phase 3: Documentation ──────────────────────────────────────────────

  private async generateDocumentation(): Promise<void> {
    this.chat.setStep('documentation');

    const { topic, requirements } = this.getTopicAndRequirements();

    if (!this.executor) {
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
      return;
    }

    const draft = await this.generateDocumentationDraft(topic, requirements);
    if (!draft) {
      this.chat.addMessage(
        'orchestrator',
        '문서 생성에 실패했습니다. 잠시 후 "다음" 또는 "next"로 다시 진행해 주세요.',
      );
      this.chat.setStep('onboarding');
      return;
    }

    this.lastDocDraft = draft;

    const tabs = [
      { label: 'PRD', html: this.renderGeneratedDocHtml('PRD', draft.prd) },
      { label: 'TechSpec', html: this.renderGeneratedDocHtml('TechSpec', draft.techSpec) },
      { label: 'Tasks', html: this.renderGeneratedDocHtml('Tasks', draft.tasks) },
    ];

    const card = this.chat.createDecision(
      'documentation',
      'Documentation Plan',
      draft.summary || `다음 3개 문서를 생성했습니다. 탭을 전환하여 검토 후 승인해 주세요.`,
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
      this.saveDocumentationFiles();
      this.chat.addMessage('orchestrator', `문서 생성이 승인되었습니다. 개발을 위한 Bot Team을 제안합니다...`);
      setTimeout(() => this.generateDevelopmentProposal(), 500);
    } else if (card.status === 'modified') {
      this.chat.addMessage('orchestrator',
        `수정 요청을 반영합니다: "${card.response}"\n문서 계획을 재구성합니다.`);
      setTimeout(() => {
        void this.generateDocumentation();
      }, 200);
    } else {
      this.chat.addMessage('orchestrator', `문서 생성이 거부되었습니다. 온보딩으로 돌아갑니다.`);
      this.chat.setStep('onboarding');
    }
  }

  /**
   * Save documentation markdown files to the project's docs/ folder.
   */
  private saveDocumentationFiles(): void {
    if (!this.projectPath || !this.lastDocDraft) return;

    const docsDir = path.join(this.projectPath, 'docs');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    const { topic } = this.getTopicAndRequirements();
    const safeSlug = topic
      .replace(/[^a-zA-Z0-9가-힣\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 40) || 'project';

    const files: Array<[string, string]> = [
      [`PRD-${safeSlug}.md`, this.lastDocDraft.prd],
      [`TechSpec-${safeSlug}.md`, this.lastDocDraft.techSpec],
      [`Tasks-${safeSlug}.md`, this.lastDocDraft.tasks],
    ];

    for (const [name, content] of files) {
      const filePath = path.join(docsDir, name);
      fs.writeFileSync(filePath, content, 'utf-8');
    }

    this.chat.addMessage('orchestrator',
      `문서 3종을 프로젝트에 저장했습니다:\n${files.map(([n]) => `- docs/${n}`).join('\n')}`,
    );
  }

  /**
   * Parse task items from the Tasks markdown document.
   */
  private parseTasksFromDocumentation(): string[] {
    if (!this.lastDocDraft?.tasks) return [];

    const lines = this.lastDocDraft.tasks.split('\n');
    const tasks: string[] = [];
    for (const line of lines) {
      const match = line.match(/^-\s*\[[\sx]\]\s*(?:🔴|🟡|🟢)?\s*(?:\*\*\[P[012]\]\*\*)?\s*(.+)/i);
      if (match && match[1]) {
        const task = match[1].replace(/\*\*/g, '').trim();
        if (task.length > 5) tasks.push(task);
      }
    }
    return tasks;
  }

  // ─── Phase 4: Development ────────────────────────────────────────────────

  private generateDevelopmentProposal(): void {
    this.chat.setStep('development');

    const { topic } = this.getTopicAndRequirements();
    const docTasks = this.parseTasksFromDocumentation();
    const effectiveTasks = docTasks.length > 0 ? docTasks : this.conversationContext.slice(1).filter(c => c.trim().length > 0);

    const taskList = effectiveTasks.length > 0
      ? effectiveTasks.slice(0, 10).map((r, i) => `  ${i + 1}. ${r.substring(0, 80)}`)
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
    const { topic } = this.getTopicAndRequirements();
    this.devStartedAt = new Date().toISOString();
    this.devResults = [];
    this.stopRequested = false;

    // Use parsed documentation tasks, fallback to conversation context
    const docTasks = this.parseTasksFromDocumentation();
    const effectiveTasks = docTasks.length > 0
      ? docTasks
      : this.conversationContext.slice(1).filter(c => c.trim().length > 0);

    // Build TechSpec context for the developer
    const techSpecContext = this.lastDocDraft?.techSpec
      ? `\n\n[TechSpec 참조]\n${this.lastDocDraft.techSpec.substring(0, 2000)}`
      : '';

    const buildDeveloperTask = (goal: string): string => [
      `현재 워크스페이스에서 다음 요구사항을 실제 코드 변경으로 구현하세요: ${goal}`,
      `질문 없이 합리적 가정으로 진행하고, 필요한 파일을 직접 수정하세요.`,
      `완료 시 변경 파일 목록, 핵심 구현 내용, 수행한 검증(테스트/빌드)을 간결히 보고하세요.`,
    ].join('\n');

    // Group related tasks into batches for efficiency (max 3 tasks per batch)
    const taskBatches = this.batchTasks(effectiveTasks, 3);
    const devTasks = taskBatches.length > 0
      ? taskBatches.map(batch => buildDeveloperTask(batch.join('\n- ')))
      : [buildDeveloperTask(`${topic}의 핵심 기능`)];

    const botSpecs: BotSpec[] = [
      {
        name: 'developer',
        role: 'developer',
        systemPrompt: [
          `당신은 숙련된 개발자입니다.`,
          `프로젝트 목표: ${topic}`,
          `요구사항을 구현 중심으로 처리하고, 확인 질문 없이 실질적인 코드 변경을 완료하세요.`,
          `docs/ 폴더의 PRD, TechSpec, Tasks 문서를 참조하여 정확한 구현을 수행하세요.`,
          techSpecContext,
        ].join(' '),
        tasks: devTasks,
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
      },
      {
        name: 'reviewer',
        role: 'reviewer',
        systemPrompt: [
          `당신은 코드 리뷰어입니다. 개발된 코드의 품질, 보안, 성능을 검증하세요.`,
          `docs/ 폴더의 PRD와 Tasks 문서를 기준으로 목표 달성도를 확인하세요.`,
        ].join(' '),
        tasks: ['docs/ 폴더의 PRD와 Tasks 기준으로 개발된 코드를 리뷰하고 이슈를 보고하세요.'],
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
    if (!this.botComposer) {
      this.chat.addMessage('orchestrator', '실행 엔진이 연결되지 않아 개발을 시작할 수 없습니다.');
      this.chat.setStep('onboarding');
      this.stopDevelopmentHeartbeat();
      this.chat.setActiveBots([]);
      return;
    }
    void this.runDevelopmentPipeline(botSpecs);
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
    const botSummaries = this.buildBotSummaries(results);

    // Inline tab (backwards compat)
    const reviewHtml = buildReviewHtml({
      topic,
      tasksCompleted: succeeded.length,
      tasksFailed: failed.length,
      totalCostUsd: totalCost,
      durationMs: totalDuration,
      modifiedFiles,
      botSummaries,
      goals: this.conversationContext.slice(0, 5),
      failureReasons,
    });

    // Cross-reference with prediction
    const prediction: PredictionSnapshot | null = this.lastPredictionDraft
      ? {
        requirements: this.lastPredictionDraft.requirements,
        userFlow: this.lastPredictionDraft.userFlow,
        completionCriteria: this.lastPredictionDraft.completionCriteria,
        architecture: this.lastPredictionDraft.architecture,
      }
      : null;

    const reviewerText = this.extractReviewerText(results);
    const requirementResults = prediction
      ? this.inferRequirementResults(prediction.requirements, reviewerText, results)
      : [];

    const doneCount = requirementResults.filter(r => r.status === 'done').length;
    const partialCount = requirementResults.filter(r => r.status === 'partial').length;
    const totalReqs = requirementResults.length;
    const achievementRate = totalReqs > 0
      ? Math.round(((doneCount + partialCount * 0.5) / totalReqs) * 100)
      : (succeeded.length > 0 ? 100 : 0);

    // Standalone review artifact HTML
    let previewUrl = '';
    if (this.projectPath) {
      const artifactHtml = buildReviewArtifactHtml({
        topic,
        tasksCompleted: succeeded.length,
        tasksFailed: failed.length,
        totalCostUsd: totalCost,
        durationMs: totalDuration,
        modifiedFiles,
        botSummaries,
        failureReasons,
        prediction,
        requirementResults,
        reviewerText,
        achievementRate,
      });
      const preview = savePreviewHtml(this.projectPath, artifactHtml, 'review');
      previewUrl = `/api/preview/${preview.id}`;
    }

    const topReason = failureReasons
      .slice(0, 2)
      .map((f) => (f.errorCode ? `${f.errorCode}(${f.botName})` : `${f.reason.substring(0, 28)}(${f.botName})`))
      .join(', ');

    const description = [
      `**결과 검토 보고서**\n`,
      `**프로젝트:** ${topic}`,
      `**완료:** ${succeeded.length}개 / **실패:** ${failed.length}개`,
      `**비용:** $${totalCost.toFixed(4)}`,
      `**목표 달성률:** ${achievementRate}%`,
      ...(topReason ? [`**주요 실패 원인:** ${topReason}`] : []),
      ...(previewUrl ? [`\n상세 보고서: ${previewUrl}`] : []),
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
    this.lastDocDraft = null;
    this.lastPredictionDraft = null;

    this.botComposer?.reset();

    this.chat.addMessage('orchestrator', [
      `**새 Epic을 시작합니다!**\n`,
      `**주제:** ${topic}\n`,
      `자유롭게 대화하면서 목표를 구체화해 주세요.`,
      `핵심 요구사항과 제약을 먼저 정리해 주시면 바로 설계를 이어가겠습니다.`,
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

  private generateTemplateConversationalResponse(content: string): string {
    const msgCount = this.conversationContext.length;

    if (content.includes('?') || content.includes('어떻게') || content.includes('뭐')) {
      return [
        `좋은 질문입니다.\n`,
        `추가로 알고 싶은 내용이 있으시면 말씀해주세요.`,
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
        `확정된 조건부터 순서대로 알려주시면 됩니다.`,
      ].join('\n');
    }

    if (msgCount <= 4) {
      return [
        `좋습니다, 점점 구체화되고 있습니다.\n`,
        `지금까지 파악한 내용:`,
        ...this.conversationContext.map((c, i) => `  ${i + 1}. ${c.substring(0, 80)}`),
        `\n이대로 예측 산출물을 생성하려면 "preview 생성"이라고 입력해 주세요.`,
      ].join('\n');
    }

    return [
      `메모했습니다.\n`,
      `지금까지 ${msgCount}개의 메시지를 교환했습니다.`,
      `정보가 충분하면 "preview 생성" 또는 "다음"으로 예측 산출물을 만들 수 있습니다.`,
    ].join('\n');
  }

  private getBaseExecutorConfig(): ExecutorConfig {
    if (this.projectPath) {
      return buildExecutorConfig(this.projectPath);
    }
    return {
      cwd: process.cwd(),
      permissionMode: 'bypassPermissions',
      taskTimeoutMs: 180_000,
      logLevel: 'info',
      maxTurnsPerTask: 24,
    };
  }

  private async executeOrchestratorTask(
    prompt: string,
    overrides: Partial<ExecutorConfig> = {},
  ): Promise<TaskResult> {
    if (!this.executor) {
      return {
        success: false,
        result: 'Executor not configured',
        costUsd: 0,
        durationMs: 0,
        sessionId: '',
        errors: ['Executor not configured'],
      };
    }

    const base = this.getBaseExecutorConfig();
    const config: ExecutorConfig = {
      ...base,
      ...overrides,
      cwd: overrides.cwd ?? base.cwd,
      permissionMode: overrides.permissionMode ?? base.permissionMode,
      taskTimeoutMs: overrides.taskTimeoutMs ?? base.taskTimeoutMs,
      logLevel: overrides.logLevel ?? base.logLevel,
      maxTurnsPerTask: overrides.maxTurnsPerTask ?? base.maxTurnsPerTask,
      maxBudgetPerTaskUsd: overrides.maxBudgetPerTaskUsd ?? base.maxBudgetPerTaskUsd,
      allowedTools: overrides.allowedTools ?? base.allowedTools,
      systemPromptPrefix: overrides.systemPromptPrefix ?? base.systemPromptPrefix,
    };

    return this.executor.execute({
      prompt,
      config,
      cwd: config.cwd,
    });
  }

  private sanitizeModelText(raw: string): string {
    const text = raw.replace(/^\s*```(?:markdown|md|text)?\s*/i, '').replace(/```\s*$/, '').trim();
    return text;
  }

  private extractNumericSelection(text: string): string | null {
    const m = text.trim().match(/^(\d{1,2})(?:번)?$/);
    return m ? m[1] : null;
  }

  private buildCompactOnboardingReply(userInput: string): string {
    const selection = this.extractNumericSelection(userInput);
    const inputPreview = userInput.length > 80 ? `${userInput.slice(0, 77)}...` : userInput;

    const lines: string[] = [];
    lines.push(`방금 입력을 반영했습니다: "${inputPreview}"`);
    if (selection) {
      lines.push(`${selection}번 선택으로 이해했습니다.`);
    }
    lines.push('중복 질문은 생략하고 현재 정리된 목표로 진행하겠습니다.');
    lines.push('추가로 필요한 조건이 있으면 한 줄로만 알려주세요.');
    return lines.join('\n');
  }

  private async generatePredictionArtifactWithOpus(
    topic: string,
    requirements: string[],
    architecture: string[],
    userFlow: string[],
    completionCriteria: string[],
  ): Promise<{ html: string; summary: string; model: string } | null> {
    const reqBlock = requirements.length > 0
      ? requirements.slice(0, 8).map((r, i) => `${i + 1}. ${r}`).join('\n')
      : '(요구사항 없음)';
    const archBlock = architecture.length > 0
      ? architecture.slice(0, 6).map((r, i) => `${i + 1}. ${r}`).join('\n')
      : '(없음)';
    const flowBlock = userFlow.length > 0
      ? userFlow.slice(0, 6).map((r, i) => `${i + 1}. ${r}`).join('\n')
      : '(없음)';
    const doneBlock = completionCriteria.length > 0
      ? completionCriteria.slice(0, 8).map((r, i) => `${i + 1}. ${r}`).join('\n')
      : '(없음)';

    const prompt = [
      '당신은 제품 설계 시각화 전문가입니다.',
      '최종 결과물의 예상 모습을 "외부 브라우저에서 열 HTML artifact"로 생성하세요.',
      '반드시 JSON 객체 하나만 출력하세요. 코드블록/설명 문장 금지.',
      'Schema:',
      '{"summary":"string","html":"<!doctype html>..."}',
      'HTML 요구사항:',
      '- standalone 문서(doctype, html, head, body 포함)',
      '- 한국어 텍스트 사용',
      '- UI/UX mockup 섹션',
      '- 아키텍처 맵 섹션',
      '- DFD(Data Flow Diagram) 섹션 (SVG 필수)',
      '- 사용자 시나리오 섹션',
      '- 완료 기준/범위 섹션',
      '- 외부 CDN/이미지/폰트 의존성 금지',
      '- 시각적으로 읽기 쉬운 스타일 포함',
      `topic: ${topic}`,
      '[요구사항]',
      reqBlock,
      '[아키텍처 힌트]',
      archBlock,
      '[사용자 흐름 힌트]',
      flowBlock,
      '[완료 기준 힌트]',
      doneBlock,
    ].join('\n');

    const opusModel = 'claude-opus-4-1';
    const result = await this.executeOrchestratorTask(prompt, {
      model: opusModel,
      maxTurnsPerTask: 10,
      taskTimeoutMs: Math.min(this.getBaseExecutorConfig().taskTimeoutMs, 220_000),
      maxBudgetPerTaskUsd: 1.2,
      allowedTools: ['Read', 'Grep', 'Glob'],
    });

    if (!result.success) return null;

    const parsed = this.parseJsonObject<Record<string, unknown>>(result.result);
    if (!parsed) return null;

    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    const rawHtml = typeof parsed.html === 'string' ? parsed.html.trim() : '';
    if (!rawHtml) return null;

    const html = this.ensureStandaloneHtml(rawHtml, topic);
    return {
      html,
      summary: summary || `${topic}에 대한 시각화 artifact입니다.`,
      model: opusModel,
    };
  }

  private ensureStandaloneHtml(rawHtml: string, topic: string): string {
    const clean = this.sanitizeModelText(rawHtml);
    const looksStandalone = /<html[\s>]/i.test(clean) && /<body[\s>]/i.test(clean);
    if (looksStandalone) return clean;
    const safeTitle = topic
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Output Preview — ${safeTitle}</title>
</head>
<body>
${clean}
</body>
</html>`;
  }

  private shouldUseCompactOnboardingReply(nextReply: string): boolean {
    const normalizedNextLength = nextReply.replace(/\s+/g, '').length;
    if (normalizedNextLength < 80) return false;

    const messages = this.chat.getMessages('main');
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== 'orchestrator') continue;
      const prev = msg.content;
      const normalizedPrevLength = prev.replace(/\s+/g, '').length;
      if (normalizedPrevLength < 80) return false;
      const similarity = this.calculateTokenJaccard(prev, nextReply);
      return similarity >= 0.72;
    }
    return false;
  }

  private calculateTokenJaccard(a: string, b: string): number {
    const tokenize = (text: string): Set<string> => {
      const tokens = text
        .toLowerCase()
        .replace(/[`*#>\-(){}[\].,:;!?/\\|"'~]/g, ' ')
        .match(/[가-힣a-z0-9]+/g) ?? [];
      return new Set(tokens.filter((t) => t.length >= 1));
    };

    const setA = tokenize(a);
    const setB = tokenize(b);
    if (setA.size === 0 || setB.size === 0) return 0;

    let intersection = 0;
    for (const token of setA) {
      if (setB.has(token)) intersection++;
    }
    const union = setA.size + setB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  private buildProjectContextPrompt(): string {
    if (!this.projectContext) return '';

    const lines: string[] = [];
    if (this.projectContext.config) {
      lines.push(`[프로젝트 설정] model=${this.projectContext.config.model ?? 'default'}, budget=${this.projectContext.config.maxTotalBudgetUsd ?? 'n/a'}`);
    }

    if (this.projectContext.agentsMd) {
      const snippet = this.projectContext.agentsMd.split('\n').slice(0, 14).join('\n');
      lines.push('[AGENTS.md]');
      lines.push(snippet);
    }

    if (this.projectContext.docs) {
      lines.push('[docs 요약]');
      const docs = Object.entries(this.projectContext.docs).slice(0, 4);
      for (const [name, content] of docs) {
        lines.push(`- ${name}: ${content.split('\n')[0] ?? ''}`);
      }
    }

    return lines.length > 0 ? lines.join('\n') : '';
  }

  private parseJsonObject<T>(raw: string): T | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const noFence = trimmed
      .replace(/^\s*```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    const start = noFence.indexOf('{');
    const end = noFence.lastIndexOf('}');
    if (start < 0 || end <= start) return null;

    const candidate = noFence.slice(start, end + 1);
    try {
      return JSON.parse(candidate) as T;
    } catch {
      return null;
    }
  }

  private toStringArray(value: unknown, max = 8): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, max);
  }

  private async generatePredictionDraft(topic: string, requirements: string[]): Promise<PredictionDraft | null> {
    const reqBlock = requirements.length > 0
      ? requirements.slice(0, 10).map((r, i) => `${i + 1}. ${r}`).join('\n')
      : '(요구사항 없음)';

    const prompt = [
      '다음 프로젝트의 Output Preview 초안을 작성하세요.',
      '반드시 JSON 객체 하나만 출력하세요. 코드블록/설명 금지.',
      'Schema:',
      '{"summary":"string","requirements":["string"],"userFlow":["string"],"completionCriteria":["string"],"architecture":["string"]}',
      `topic: ${topic}`,
      '[요구사항]',
      reqBlock,
      '규칙:',
      '- requirements/userFlow/completionCriteria/architecture는 각각 3~6개 항목',
      '- 모든 텍스트는 한국어',
      '- 실행 가능한 문장으로 작성',
    ].join('\n');

    const result = await this.executeOrchestratorTask(prompt, {
      maxTurnsPerTask: 6,
      taskTimeoutMs: Math.min(this.getBaseExecutorConfig().taskTimeoutMs, 150_000),
      maxBudgetPerTaskUsd: 0.5,
      allowedTools: ['Read', 'Grep', 'Glob'],
    });

    if (!result.success) return null;

    const parsed = this.parseJsonObject<Record<string, unknown>>(result.result);
    if (!parsed) return null;

    const normalized: PredictionDraft = {
      summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
      requirements: this.toStringArray(parsed.requirements, 8),
      userFlow: this.toStringArray(parsed.userFlow, 8),
      completionCriteria: this.toStringArray(parsed.completionCriteria, 8),
      architecture: this.toStringArray(parsed.architecture, 8),
    };

    if (normalized.requirements.length === 0) {
      normalized.requirements = requirements.length > 0
        ? requirements.slice(0, 6)
        : ['핵심 기능 구현', '테스트 작성', '결과 리뷰'];
    }
    if (normalized.userFlow.length === 0) {
      normalized.userFlow = ['요구사항 정리', '문서 생성', '개발', '리뷰'];
    }
    if (normalized.completionCriteria.length === 0) {
      normalized.completionCriteria = ['핵심 기능 동작', '테스트 통과', '리뷰 승인'];
    }
    if (normalized.architecture.length === 0) {
      normalized.architecture = ['Frontend', 'Backend', 'Storage'];
    }

    return normalized;
  }

  private async generateDocumentationDraft(topic: string, requirements: string[]): Promise<DocumentationDraft | null> {
    const reqBlock = requirements.length > 0
      ? requirements.slice(0, 10).map((r, i) => `${i + 1}. ${r}`).join('\n')
      : '- 요구사항을 대화 기반으로 정리';

    const prompt = [
      '다음 프로젝트의 PRD/TechSpec/Tasks 초안을 작성하세요.',
      '반드시 JSON 객체 하나만 출력하세요. 코드블록/설명 금지.',
      'Schema:',
      '{"summary":"string","prd":"markdown","techSpec":"markdown","tasks":"markdown"}',
      `topic: ${topic}`,
      '[요구사항]',
      reqBlock,
      '작성 규칙:',
      '- prd: 목표/유저스토리/비기능요건/성공지표 포함',
      '- techSpec: 아키텍처/핵심 컴포넌트/API/데이터/리스크 포함',
      '- tasks: 체크박스 형태의 실행 목록과 우선순위 포함',
      '- 한국어로 작성',
    ].join('\n');

    const result = await this.executeOrchestratorTask(prompt, {
      maxTurnsPerTask: 8,
      taskTimeoutMs: Math.min(this.getBaseExecutorConfig().taskTimeoutMs, 180_000),
      maxBudgetPerTaskUsd: 0.8,
      allowedTools: ['Read', 'Grep', 'Glob'],
    });

    if (!result.success) return null;

    const parsed = this.parseJsonObject<Record<string, unknown>>(result.result);
    if (!parsed) return null;

    const prd = typeof parsed.prd === 'string' ? parsed.prd.trim() : '';
    const techSpec = typeof parsed.techSpec === 'string' ? parsed.techSpec.trim() : '';
    const tasks = typeof parsed.tasks === 'string' ? parsed.tasks.trim() : '';
    if (!prd || !techSpec || !tasks) return null;

    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
      prd,
      techSpec,
      tasks,
    };
  }

  private renderGeneratedDocHtml(label: string, markdown: string): string {
    const escaped = markdown
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    return `<style>
  .doc { font-family: system-ui, -apple-system, sans-serif; color: #1f2328; font-size: 13px; line-height: 1.5; }
  .doc h3 { margin: 0 0 12px; font-size: 15px; color: #0d1117; }
  .doc pre {
    white-space: pre-wrap;
    word-break: break-word;
    background: #f6f8fa;
    border: 1px solid #d0d7de;
    border-radius: 8px;
    padding: 12px;
    margin: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 12px;
  }
</style>
<div class="doc">
  <h3>${label}</h3>
  <pre>${escaped}</pre>
</div>`;
  }

  private resetState(): void {
    this.stopDevelopmentHeartbeat();
    this.conversationContext = [];
    this.devResults = [];
    this.devStartedAt = null;
    this.stopRequested = false;
    this.onboardingReplyQueue = Promise.resolve();
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

  private extractReviewerText(results: BotTaskResult[]): string {
    return results
      .filter(r => r.botName === 'reviewer' && r.result)
      .map(r => r.result)
      .join('\n\n');
  }

  private inferRequirementResults(
    requirements: string[],
    reviewerText: string,
    results: BotTaskResult[],
  ): RequirementCheckResult[] {
    const successText = results
      .filter(r => r.success && r.result)
      .map(r => r.result)
      .join(' ');
    const combined = `${reviewerText} ${successText}`.toLowerCase();

    return requirements.map(req => {
      // Extract keywords (2+ char tokens) from the requirement
      const keywords = req
        .toLowerCase()
        .replace(/[^a-z0-9가-힣\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 2);

      if (keywords.length === 0) {
        return { text: req, status: 'not-done' as const };
      }

      const matchCount = keywords.filter(kw => combined.includes(kw)).length;
      const ratio = matchCount / keywords.length;

      if (ratio >= 0.5) {
        return {
          text: req,
          status: 'done' as const,
          evidence: `키워드 ${matchCount}/${keywords.length} 매칭`,
        };
      } else if (ratio >= 0.25) {
        return {
          text: req,
          status: 'partial' as const,
          evidence: `키워드 ${matchCount}/${keywords.length} 부분 매칭`,
        };
      } else {
        return { text: req, status: 'not-done' as const };
      }
    });
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

  private batchTasks(tasks: string[], batchSize: number): string[][] {
    const batches: string[][] = [];
    for (let i = 0; i < tasks.length; i += batchSize) {
      batches.push(tasks.slice(i, i + batchSize));
    }
    return batches;
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

interface PredictionDraft {
  summary: string;
  requirements: string[];
  userFlow: string[];
  completionCriteria: string[];
  architecture: string[];
}

interface DocumentationDraft {
  summary: string;
  prd: string;
  techSpec: string;
  tasks: string;
}

interface ProjectContext {
  agentsMd: string | null;
  docs: Record<string, string> | null;
  config: Partial<import('../../shared/types.js').ClaudeBotConfig> | null;
}
