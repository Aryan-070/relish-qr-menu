import { useEffect, useState } from 'react'
import { LogOut, Calendar, UserCog } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useViewCtx } from '../ViewContext'
import { NAV, ROLE_LABEL } from '../nav'
import { DATE_RANGES, type Role } from '../lib/types'

interface CommandPaletteProps {
  onExit: () => void
  showRoleSwitcher: boolean
  onRole: (r: Role) => void
  onDateRange: (days: 7 | 14 | 30) => void
}

const ROLES: Role[] = ['admin', 'manager', 'waiter']

/**
 * ⌘K / Ctrl+K quick-nav for the console. Sources its primary actions from the
 * role-scoped NAV (so it always mirrors the sidebar), plus date-range presets,
 * a role switch (demo only), and exit-to-menu.
 */
export function CommandPalette({ onExit, showRoleSwitcher, onRole, onDateRange }: CommandPaletteProps) {
  const { role, navigate } = useViewCtx()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const run = (fn: () => void) => {
    fn()
    setOpen(false)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search views, switch range or role…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>

        <CommandGroup heading="Navigate">
          {NAV[role].map(item => {
            const Icon = item.icon
            return (
              <CommandItem key={item.view} value={`go ${item.label}`} onSelect={() => run(() => navigate(item.view))}>
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
              </CommandItem>
            )
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Date range">
          {DATE_RANGES.map(r => (
            <CommandItem key={r.days} value={`range ${r.label}`} onSelect={() => run(() => onDateRange(r.days))}>
              <Calendar className="mr-2 h-4 w-4" />
              {r.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {showRoleSwitcher && (
          <CommandGroup heading="Demo role">
            {ROLES.map(r => (
              <CommandItem key={r} value={`role ${ROLE_LABEL[r]}`} onSelect={() => run(() => onRole(r))}>
                <UserCog className="mr-2 h-4 w-4" />
                View as {ROLE_LABEL[r]}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem value="exit to menu" onSelect={() => run(onExit)}>
            <LogOut className="mr-2 h-4 w-4" />
            Exit to guest menu
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
