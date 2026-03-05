import type { WorkflowStateDTO, WorkflowStep } from '@shared/api-types';

interface WorkflowBarProps {
  workflow: WorkflowStateDTO | null;
  connected: boolean;
  isThinking?: boolean;
  onReset?: () => void;
  onToggleAutoPilot?: (enabled: boolean) => void;
}

const steps: { key: WorkflowStep; label: string }[] = [
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'prediction', label: 'Prediction' },
  { key: 'documentation', label: 'Docs' },
  { key: 'development', label: 'Dev' },
  { key: 'review', label: 'Review' },
  { key: 'completed', label: 'Done' },
];

const stepOrder: Record<WorkflowStep, number> = {
  idle: -1,
  onboarding: 0,
  prediction: 1,
  documentation: 2,
  development: 3,
  review: 4,
  completed: 5,
};

export default function WorkflowBar({
  workflow,
  connected,
  isThinking = false,
  onReset,
  onToggleAutoPilot,
}: WorkflowBarProps) {
  const currentStep = workflow?.step ?? 'idle';
  const currentIdx = stepOrder[currentStep];
  const epicNumber = workflow?.epicNumber ?? 0;
  const isAutoPilot = workflow?.autoOnboarding ?? false;
  const onboardingInProgress = currentStep === 'onboarding' && isThinking;

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg px-4 py-3">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Workflow</h2>
          {onboardingInProgress && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-info)] bg-opacity-20 text-[var(--color-info)] animate-pulse">
              Onboarding 진행중
            </span>
          )}
          {epicNumber > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-sdk)] bg-opacity-20 text-[var(--color-sdk)]">
              Epic #{epicNumber}
            </span>
          )}
          {workflow?.topic && (
            <span className="text-xs text-[var(--text-secondary)] truncate max-w-xs">
              — {workflow.topic}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {onToggleAutoPilot && (
            <button
              onClick={() => onToggleAutoPilot(!isAutoPilot)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                isAutoPilot
                  ? 'bg-[var(--color-success)] text-white'
                  : 'text-[var(--text-muted)] bg-[var(--bg-overlay)] hover:bg-[var(--border-default)]'
              }`}
              title={isAutoPilot ? 'Auto-Pilot ON' : 'Auto-Pilot OFF'}
            >
              {isAutoPilot ? 'Auto-Pilot ON' : 'Auto-Pilot'}
            </button>
          )}
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
                className={`flex-1 text-center py-1 px-2 rounded text-xs font-medium transition-colors ${
                  onboardingInProgress && isActive ? 'animate-pulse' : ''
                }`}
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
