interface ImagePlaceholderProps {
  label?: string
  aspectRatio?: string
  className?: string
}

export function ImagePlaceholder({
  label = 'Image',
  aspectRatio = 'aspect-[4/3]',
  className = '',
}: ImagePlaceholderProps) {
  return (
    <div
      className={[
        'relative overflow-hidden rounded-xl',
        aspectRatio,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        background: `repeating-linear-gradient(
          45deg,
          #F7EBD2,
          #F7EBD2 8px,
          #FFF8EA 8px,
          #FFF8EA 16px
        )`,
        border: '1.5px dashed #D9A03A',
      }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="opacity-30">
          <rect x="3" y="3" width="18" height="18" rx="3" stroke="#8B1024" strokeWidth="1.5" />
          <circle cx="8.5" cy="8.5" r="1.5" fill="#D9A03A" />
          <path d="M3 15l5-5 4 4 3-3 6 6" stroke="#8B1024" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span
          className="text-[10px] font-inter uppercase tracking-widest"
          style={{ color: '#8B1024', opacity: 0.4 }}
        >
          {label}
        </span>
      </div>
    </div>
  )
}
