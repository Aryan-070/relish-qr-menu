import { useTheme } from '../../theme/ThemeContext'
import { isHard } from '../lib/skin'

interface AvatarProps {
  name: string
  hue?: number
  size?: number
}

function initials(name: string): string {
  return name
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** Generated monogram avatar tinted by the staff member's hue. */
export function Avatar({ name, hue = 350, size = 32 }: AvatarProps) {
  const { tokens: t } = useTheme()
  const hard = isHard(t)
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center font-semibold shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        borderRadius: hard ? 0 : 999,
        background: `hsl(${hue} 45% 92%)`,
        color: `hsl(${hue} 55% 32%)`,
        border: `1px solid hsl(${hue} 40% 80%)`,
        fontFamily: t.descFont,
      }}
    >
      {initials(name)}
    </span>
  )
}
