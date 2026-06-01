import type { ReactNode } from 'react'
import { useTheme } from '../../theme/ThemeContext'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const { tokens: t } = useTheme()
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 gap-2">
      {icon && <div style={{ color: t.descColor }} className="mb-1 opacity-70">{icon}</div>}
      <p className="text-[15px]" style={{ fontFamily: t.titleFont, color: t.ink, fontWeight: t.titleWeight }}>
        {title}
      </p>
      {description && (
        <p className="text-[13px] max-w-[34ch]" style={{ fontFamily: t.descFont, color: t.descColor }}>
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
