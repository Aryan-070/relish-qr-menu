import { formatMoney, type CurrencyCode } from '../../lib/money'

interface PriceProps {
  amount: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
  currency?: CurrencyCode
}

const sizes = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
}

export function Price({ amount, size = 'md', className = '', currency }: PriceProps) {
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
      {formatMoney(amount, currency)}
    </span>
  )
}
