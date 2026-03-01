import type { OnboardingResult } from './types.js';

/**
 * Onboarding state machine — Phase 4.6
 *
 * States: ONBOARDING → POC_PENDING → SUB_BOT_PROPOSAL → EXECUTION → COMPLETE
 *
 * During ONBOARDING, the orchestrator analyzes the user's goal
 * and generates PRD-{topic}.md, TechSpec-{topic}.md, Task-{topic}.md.
 */

export type OnboardingState =
  | 'ONBOARDING'
  | 'POC_PENDING'
  | 'SUB_BOT_PROPOSAL'
  | 'EXECUTION'
  | 'COMPLETE';

export interface OnboardingContext {
  state: OnboardingState;
  topic: string;
  conversationHistory: string[];
  documents?: OnboardingResult;
  pocRequired: boolean;
  pocCompleted: boolean;
}

export class OnboardingStateMachine {
  private ctx: OnboardingContext;

  constructor(topic: string) {
    this.ctx = {
      state: 'ONBOARDING',
      topic,
      conversationHistory: [],
      pocRequired: false,
      pocCompleted: false,
    };
  }

  get state(): OnboardingState {
    return this.ctx.state;
  }

  get context(): Readonly<OnboardingContext> {
    return this.ctx;
  }

  /** Add a message to conversation history. */
  addMessage(content: string): void {
    this.ctx.conversationHistory.push(content);
  }

  /**
   * Transition to POC_PENDING if PoC is required.
   * Called after onboarding analysis determines technical difficulty.
   */
  requestPoC(): boolean {
    if (this.ctx.state !== 'ONBOARDING') return false;
    this.ctx.pocRequired = true;
    this.ctx.state = 'POC_PENDING';
    return true;
  }

  /**
   * Mark PoC as completed and transition to SUB_BOT_PROPOSAL.
   */
  completePoC(pocResults: string): boolean {
    if (this.ctx.state !== 'POC_PENDING') return false;
    this.ctx.pocCompleted = true;
    if (this.ctx.documents) {
      this.ctx.documents.pocResults = pocResults;
    }
    this.ctx.state = 'SUB_BOT_PROPOSAL';
    return true;
  }

  /**
   * Transition from ONBOARDING to SUB_BOT_PROPOSAL (no PoC needed).
   */
  advanceToProposal(documents: OnboardingResult): boolean {
    if (this.ctx.state !== 'ONBOARDING') return false;
    this.ctx.documents = documents;
    this.ctx.state = 'SUB_BOT_PROPOSAL';
    return true;
  }

  /**
   * Transition from SUB_BOT_PROPOSAL to EXECUTION after user approval.
   */
  startExecution(): boolean {
    if (this.ctx.state !== 'SUB_BOT_PROPOSAL') return false;
    this.ctx.state = 'EXECUTION';
    return true;
  }

  /**
   * Mark as complete.
   */
  complete(): boolean {
    if (this.ctx.state !== 'EXECUTION') return false;
    this.ctx.state = 'COMPLETE';
    return true;
  }

  /**
   * Analyze topic for technical difficulty to determine if PoC is needed.
   * Returns true if PoC is recommended.
   */
  assessPoCNeed(topic: string): boolean {
    const complexKeywords = [
      'ml', 'machine learning', 'ai', 'gpu', 'cuda',
      'distributed', 'blockchain', 'real-time', 'streaming',
      'migration', 'legacy', 'performance', 'optimization',
    ];
    const lower = topic.toLowerCase();
    return complexKeywords.some(kw => lower.includes(kw));
  }

  /**
   * Generate document templates based on conversation context.
   */
  generateDocuments(): OnboardingResult {
    const topic = this.ctx.topic;
    const history = this.ctx.conversationHistory;

    const prdContent = [
      `# PRD: ${topic}`,
      '',
      '## 목표',
      `${topic}`,
      '',
      '## 요구사항',
      ...history.map((msg, i) => `${i + 1}. ${msg.substring(0, 120)}`),
      '',
      '## 범위',
      '- TBD (Orchestrator가 분석 후 구체화)',
    ].join('\n');

    const techSpecContent = [
      `# TechSpec: ${topic}`,
      '',
      '## 기술 스택',
      '- TBD',
      '',
      '## 아키텍처',
      '- TBD',
    ].join('\n');

    const taskContent = [
      `# Tasks: ${topic}`,
      '',
      ...history.map((msg, i) => `- [ ] Task ${i + 1}: ${msg.substring(0, 100)}`),
    ].join('\n');

    const docs: OnboardingResult = {
      topic,
      prdContent,
      techSpecContent,
      taskContent,
      pocRequired: this.ctx.pocRequired,
    };

    this.ctx.documents = docs;
    return docs;
  }
}
