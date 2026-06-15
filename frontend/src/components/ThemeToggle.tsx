import { motion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import type { Theme } from '../lib/preferences'

interface ThemeToggleProps {
  theme: Theme
  onToggle: () => void
}

/** Skeuomorphic round key: light in light mode, dark in dark mode; hover inverts. */
export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <div className="rounded-full bg-zinc-300 p-1 dark:bg-zinc-700">
      <motion.button
        type="button"
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={onToggle}
        whileTap={{ scale: 0.92 }}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition-colors duration-150 hover:bg-zinc-800 hover:text-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-100 dark:hover:text-zinc-800"
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
          {theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
        </motion.span>
      </motion.button>
    </div>
  )
}
