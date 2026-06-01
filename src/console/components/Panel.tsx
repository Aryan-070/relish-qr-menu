import type { CSSProperties, ReactNode } from 'react'
import { useTheme } from '../../theme/ThemeContext'
import { panelStyle, sectionTitleStyle } from '../lib/skin'
import { cn } from '../lib/format'

interface PanelProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  /** Optional heading row rendered inside the panel. */
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  padded?: boolean
}

export function Panel({ children, className = '', style, title, subtitle, action, padded = true }: PanelProps) {
  const { tokens: t } = useTheme()
  return (
    <section
      style={{ ...panelStyle(t), ...style }}
      className={cn(padded && 'p-4 sm:p-5', className)}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            {title && (
              <h2 className="text-[15px] leading-tight truncate" style={sectionTitleStyle(t)}>
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs mt-0.5" style={{ color: t.descColor, fontFamily: t.descFont }}>
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
