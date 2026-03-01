/**
 * DomainDriftDetector — Phase 4.8
 *
 * Detects when a bot's work deviates from the original project goal.
 * Uses keyword-based similarity scoring (no external ML dependencies).
 */

export interface DriftResult {
  score: number;       // 0.0 (no drift) to 1.0 (complete drift)
  drifted: boolean;    // true if score > threshold
  reason?: string;     // human-readable explanation
}

export class DomainDriftDetector {
  private goalKeywords: Set<string>;
  private threshold: number;

  constructor(goal: string, threshold = 0.6) {
    this.goalKeywords = this.extractKeywords(goal);
    this.threshold = threshold;
  }

  /**
   * Check if the given work description drifts from the project goal.
   */
  detect(workDescription: string): DriftResult {
    if (this.goalKeywords.size === 0) {
      return { score: 0, drifted: false };
    }

    const workKeywords = this.extractKeywords(workDescription);
    if (workKeywords.size === 0) {
      return { score: 0, drifted: false };
    }

    // Calculate Jaccard distance (1 - similarity)
    const intersection = new Set([...this.goalKeywords].filter(k => workKeywords.has(k)));
    const union = new Set([...this.goalKeywords, ...workKeywords]);
    const similarity = intersection.size / union.size;
    const drift = 1 - similarity;

    const drifted = drift > this.threshold;
    const reason = drifted
      ? `작업이 원래 목표에서 벗어났습니다 (유사도: ${(similarity * 100).toFixed(0)}%). ` +
        `목표 키워드: ${[...this.goalKeywords].slice(0, 5).join(', ')}. ` +
        `현재 작업 키워드: ${[...workKeywords].filter(k => !this.goalKeywords.has(k)).slice(0, 5).join(', ')}`
      : undefined;

    return { score: drift, drifted, reason };
  }

  /**
   * Update goal keywords (e.g., after user refines the objective).
   */
  updateGoal(newGoal: string): void {
    this.goalKeywords = this.extractKeywords(newGoal);
  }

  /**
   * Extract meaningful keywords from text.
   */
  private extractKeywords(text: string): Set<string> {
    const stopwords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
      'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
      'into', 'through', 'during', 'before', 'after', 'above', 'below',
      'and', 'but', 'or', 'not', 'no', 'nor', 'so', 'yet', 'both',
      'this', 'that', 'these', 'those', 'it', 'its',
      // Korean particles/connectors
      '을', '를', '이', '가', '에', '의', '와', '과', '로', '으로',
      '은', '는', '도', '만', '까지', '에서', '부터', '하고',
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^\w\s가-힣]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1 && !stopwords.has(w));

    return new Set(words);
  }
}

/**
 * Analyze task dependencies for parallel execution.
 * Returns groups of tasks that can run in parallel.
 */
export function analyzeParallelTasks(
  tasks: Array<{ id: string; description: string; dependencies?: string[] }>,
): string[][] {
  const groups: string[][] = [];
  const completed = new Set<string>();
  const remaining = new Map(tasks.map(t => [t.id, t]));

  while (remaining.size > 0) {
    const batch: string[] = [];

    for (const [id, task] of remaining) {
      const deps = task.dependencies ?? [];
      if (deps.every(d => completed.has(d))) {
        batch.push(id);
      }
    }

    if (batch.length === 0) {
      // Deadlock — remaining tasks have circular dependencies
      groups.push([...remaining.keys()]);
      break;
    }

    for (const id of batch) {
      completed.add(id);
      remaining.delete(id);
    }

    groups.push(batch);
  }

  return groups;
}
