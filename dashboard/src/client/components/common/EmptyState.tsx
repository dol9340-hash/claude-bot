interface EmptyStateProps {
  title: string;
  description?: string;
}

export default function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-4xl mb-4 opacity-40">📭</div>
      <h3 className="text-base font-medium text-[var(--text-primary)] mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[var(--text-secondary)] max-w-sm">
          {description}
        </p>
      )}
    </div>
  );
}
