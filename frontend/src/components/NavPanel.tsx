import { HelpCircle, Keyboard, Settings, Timer, Trophy, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'

interface NavItem {
  to: string
  icon: LucideIcon
  labelKey: string
}

const ITEMS: NavItem[] = [
  { to: '/', icon: Keyboard, labelKey: 'nav.practice' },
  { to: '/test', icon: Timer, labelKey: 'nav.timedTest' },
  { to: '/settings', icon: Settings, labelKey: 'nav.settings' },
  { to: '/profile', icon: User, labelKey: 'nav.profile' },
  { to: '/leaderboard', icon: Trophy, labelKey: 'nav.leaderboard' },
  { to: '/help', icon: HelpCircle, labelKey: 'nav.help' },
]

/**
 * Keybr-style navigation. A floating, centered pill of icons hovering above the
 * bottom edge at every viewport size (icons only — no overlap with the content,
 * which reserves matching bottom padding in Layout).
 */
export function NavPanel() {
  const { t } = useTranslation()

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 flex-row items-center gap-1 rounded-full border border-border bg-bg/90 px-3 py-1.5 shadow-lg backdrop-blur"
    >
      {ITEMS.map(({ to, icon: Icon, labelKey }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          title={t(labelKey)}
          aria-label={t(labelKey)}
          className={({ isActive }) =>
            `flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
              isActive
                ? 'bg-accent/15 text-accent'
                : 'text-faint hover:bg-surface hover:text-fg'
            }`
          }
        >
          <Icon size={20} />
        </NavLink>
      ))}
    </nav>
  )
}
