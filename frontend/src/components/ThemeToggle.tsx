import { motion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTheme } from '../hooks/useTheme'

/**
 * Skeuomorphic dark-hardware toggle: a round key on a pill bezel whose
 * drop shadow leans away from the cursor, as if lit by it.
 */
export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const bezelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const bezel = bezelRef.current
    if (!bezel) return
    let raf = 0
    const onMove = (e: MouseEvent) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const rect = bezel.getBoundingClientRect()
        const dx = e.clientX - (rect.left + rect.width / 2)
        const dy = e.clientY - (rect.top + rect.height / 2)
        const angle = Math.atan2(dy, dx)
        const dist = Math.min(3, Math.sqrt(dx * dx + dy * dy) / (rect.width * 2) * 3)
        const x = -Math.cos(angle) * dist
        const y = -Math.sin(angle) * dist
        bezel.style.boxShadow = `
          ${x * 2.6}px ${y * 2.6}px 1.5px rgba(0,0,0,0.08),
          ${x * 5.8}px ${y * 5.8}px 3.4px rgba(0,0,0,0.12),
          ${x * 9.8}px ${y * 9.8}px 5.6px rgba(0,0,0,0.15),
          ${x * 14.8}px ${y * 14.8}px 8.5px rgba(0,0,0,0.17),
          ${x * 21.3}px ${y * 21.3}px 12.3px rgba(0,0,0,0.2)`
      })
    }
    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      ref={bezelRef}
      className="rounded-full p-1"
      style={{ background: 'linear-gradient(145deg, #2e2e30, #1a1a1c)' }}
    >
      <motion.button
        type="button"
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={toggle}
        whileTap={{ scale: 0.92 }}
        className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-300"
        style={{
          background: 'radial-gradient(circle at 35% 30%, #3a3a3d, #232325 70%)',
          boxShadow:
            'inset 0 1px 1px rgba(255,255,255,0.12), inset 0 -2px 3px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.6)',
        }}
      >
        <motion.span
          key={theme}
          initial={{ rotate: -180, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex"
        >
          {theme === 'dark' ? <Moon size={15} /> : <Sun size={15} className="text-amber-300" />}
        </motion.span>
      </motion.button>
    </div>
  )
}
