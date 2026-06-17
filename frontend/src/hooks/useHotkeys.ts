import { useEffect, useRef } from 'react'
import { comboFromEvent } from '../lib/hotkeys'
import type { HotkeyAction } from '../lib/preferences'
import { usePreferences } from './usePreferences'

/**
 * Registers global hotkey handlers for a subset of actions. Multiple components
 * can call this with different handler subsets (nav lives in Layout; restart is
 * scoped to the test page). Handlers fire on the user's bound combo and skip
 * events aimed at form controls / Clerk modals — matching the typing-capture
 * guard so Tab still tabs inside inputs.
 */
export function useHotkeys(handlers: Partial<Record<HotkeyAction, () => void>>) {
  const { prefs } = usePreferences()
  const handlersRef = useRef(handlers)
  const hotkeysRef = useRef(prefs.hotkeys)

  // Refresh refs after each render so the stable listener always sees current
  // values (without re-subscribing the window listener every keystroke).
  useEffect(() => {
    handlersRef.current = handlers
    hotkeysRef.current = prefs.hotkeys
  })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      const target = e.target as HTMLElement | null
      if (target?.closest('input, select, textarea, button, [contenteditable="true"]')) return

      const combo = comboFromEvent(e)
      const map = hotkeysRef.current
      const active = handlersRef.current
      for (const action of Object.keys(active) as HotkeyAction[]) {
        if (map[action] === combo) {
          const fn = active[action]
          if (fn) {
            e.preventDefault()
            fn()
          }
          return
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
