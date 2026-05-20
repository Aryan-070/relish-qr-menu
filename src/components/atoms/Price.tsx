interface PriceProps {
  amount: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
}

export function Price({ amount, size = 'md', className = '' }: PriceProps) {
  return (
    <span
      className={[
        'font-inter font-semibold text-maroon',
        sizes[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      ₹{amount}
    </span>
  )
}
