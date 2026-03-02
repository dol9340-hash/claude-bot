interface HtmlPreviewProps {
  html: string;
  label?: string;
  maxHeight?: number;
}

export default function HtmlPreview({ html, label, maxHeight = 400 }: HtmlPreviewProps) {
  return (
    <div className="relative rounded-md overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
      {label && (
        <div
          className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider z-10"
          style={{ background: 'var(--color-info)', color: '#fff' }}
        >
          {label}
        </div>
      )}
      <div
        className="overflow-auto"
        style={{ maxHeight, background: '#fff', isolation: 'isolate' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
