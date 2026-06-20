import { motion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import { THEMES, type Theme } from '../lib/preferences'
import { Tooltip } from './ui/Tooltip'

interface ThemeToggleProps {
  theme: Theme
  onToggle: () => void
}

/** Skeuomorphic round key. Shows a Moon for dark-family themes (Classic Dark,
 *  Coffee) and a Sun for light-family ones; clicking flips to the paired theme. */
export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = THEMES[theme].dark
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode'
  return (
    <Tooltip label={label} side="bottom" className="rounded-full bg-surface-2 p-1">
      <motion.button
        type="button"
        aria-label={label}
        onClick={onToggle}
        whileTap={{ scale: 0.92 }}
        className="relative z-0 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-surface text-fg transition-colors duration-300 before:absolute before:inset-0 before:-z-10 before:translate-x-[150%] before:translate-y-[150%] before:scale-[2.5] before:rounded-[100%] before:bg-fg before:transition-transform before:duration-500 before:content-[''] hover:text-bg hover:before:translate-x-[0%] hover:before:translate-y-[0%]"
        style={{
          boxShadow:
            'inset 0 1px 1px rgba(255,255,255,0.25), inset 0 -2px 3px rgba(0,0,0,0.25)',
        }}
      >
        <motion.span
          key={theme}
          initial={{ rotate: -180, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex"
        >
          {isDark ? <Moon size={15} /> : <Sun size={15} />}
        </motion.span>
      </motion.button>
    </Tooltip>
  )
}
