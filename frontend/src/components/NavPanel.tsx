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
 * Keybr-style navigation. A fixed right-hand icon rail on wide viewports;
 * collapses to a bottom bar on narrow ones (icons only — no overlap with the
 * content, which reserves matching padding in Layout).
 */
export function NavPanel() {
  const { t } = useTranslation()

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 flex h-14 flex-row items-center justify-around border-t border-border bg-bg/90 backdrop-blur sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:w-16 sm:flex-col sm:justify-start sm:gap-2 sm:border-l sm:border-t-0 sm:py-6"
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
