export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-[var(--border-default)] border-t-[var(--color-info)] rounded-full animate-spin" />
    </div>
  );
}
