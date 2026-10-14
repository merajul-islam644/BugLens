export function BrandMark({ size = 17 }: { size?: number }) {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg fill="none" height={size} viewBox="0 0 24 24" width={size} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <circle cx="11" cy="11" r="6" />
        <path d="M15.5 15.5 21 21" />
        <path d="M11 8.2v2.8h2.6" />
      </svg>
    </span>
  );
}
