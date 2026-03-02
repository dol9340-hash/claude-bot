import type { WorkflowStep } from '../../shared/api-types.js';

export interface HealthSnapshotInput {
  projectPath: string | null;
  workflowStep: WorkflowStep;
  messageCount: number;
  uptimeSec: number;
}

export interface HealthSnapshot {
  status: 'ok';
  timestamp: string;
  uptimeSec: number;
  projectPath: string | null;
  workflowStep: WorkflowStep;
  messageCount: number;
}

export function buildHealthSnapshot(input: HealthSnapshotInput): HealthSnapshot {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSec: Math.max(0, Math.floor(input.uptimeSec)),
    projectPath: input.projectPath,
    workflowStep: input.workflowStep,
    messageCount: Math.max(0, Math.floor(input.messageCount)),
  };
}
