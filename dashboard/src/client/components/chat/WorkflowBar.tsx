import type { WorkflowStateDTO, WorkflowStep } from '@shared/api-types';

interface WorkflowBarProps {
  workflow: WorkflowStateDTO | null;
  connected: boolean;
  onReset?: () => void;
}

const steps: { key: WorkflowStep; label: string }[] = [
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'preview', label: 'Preview' },
  { key: 'proposal', label: 'Proposal' },
  { key: 'execution', label: 'Execution' },
  { key: 'completed', label: 'Done' },
];

const stepOrder: Record<WorkflowStep, number> = {
  idle: -1,
  onboarding: 0,
  preview: 1,
  proposal: 2,
  execution: 3,
  completed: 4,
};

export default function WorkflowBar({ workflow, connected, onReset }: WorkflowBarProps) {
  const currentStep = workflow?.step ?? 'idle';
  const currentIdx = stepOrder[currentStep];

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg px-4 py-3">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Workflow</h2>
          {workflow?.topic && (
            <span className="text-xs text-[var(--text-secondary)] truncate max-w-xs">
              — {workflow.topic}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {onReset && currentStep !== 'idle' && (
            <button
              onClick={onReset}
              className="px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-overlay)] rounded hover:bg-[var(--border-default)] transition-colors"
            >
              Reset
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: connected ? 'var(--color-success)' : 'var(--color-danger)',
              }}
            />
            <span className="text-xs text-[var(--text-muted)]">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {steps.map((step, idx) => {
          const isActive = idx === currentIdx;
          const isDone = idx < currentIdx;
          const isPending = idx > currentIdx;

          let bgColor = 'var(--bg-overlay)';
          let textColor = 'var(--text-muted)';

          if (isActive) {
            bgColor = 'var(--color-info)';
            textColor = '#fff';
          } else if (isDone) {
            bgColor = 'var(--color-success)';
            textColor = '#fff';
          }

          return (
            <div key={step.key} className="flex items-center flex-1">
              <div
                className="flex-1 text-center py-1 px-2 rounded text-xs font-medium transition-colors"
                style={{
                  backgroundColor: bgColor,
                  color: textColor,
                  opacity: isPending ? 0.5 : 1,
                }}
              >
                {step.label}
              </div>
              {idx < steps.length - 1 && (
                <div
                  className="w-4 h-px mx-0.5"
                  style={{
                    backgroundColor: isDone ? 'var(--color-success)' : 'var(--bg-overlay)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
