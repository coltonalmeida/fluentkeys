import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CharState } from '../hooks/useTypingTest'

interface TypingAreaProps {
  target: string
  charStates: CharState[]
  index: number
  onKey: (key: string) => void
}

const charClass = (state: CharState | undefined): string => {
  if (state === 'correct') return 'text-fg'
  if (state === 'incorrect') return 'text-error underline decoration-error'
  return 'text-faint'
}

export function TypingArea({ target, charStates, index, onKey }: TypingAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const caretRef = useRef<HTMLDivElement>(null)
  const charRefs = useRef<(HTMLSpanElement | null)[]>([])
  const [capsOn, setCapsOn] = useState(false)

  // Caret position: plain CSS transform, no animation library. Must be instant.
  useLayoutEffect(() => {
    const container = containerRef.current
    const caret = caretRef.current
    if (!container || !caret) return

    const atEnd = index >= target.length
    const span = charRefs.current[atEnd ? target.length - 1 : index]
    if (!span) return

    const spanRect = span.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    const x = (atEnd ? spanRect.right : spanRect.left) - containerRect.left
    const y = spanRect.top - containerRect.top
    caret.style.transform = `translate(${x}px, ${y}px)`

    // Keep the active line in view
    span.scrollIntoView({ block: 'nearest' })
  }, [index, target])

  // Capture keystrokes globally so typing works without clicking the text
  // first. Skip events aimed at real form controls (settings dropdowns,
  // Clerk modals) and shortcut chords.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Surface a Caps-Lock heads-up regardless of which key fired the event.
      const caps = e.getModifierState('CapsLock')
      setCapsOn((prev) => (prev === caps ? prev : caps))
      if (e.repeat) return // holding a key types it only once
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t?.closest('input, select, textarea, button, [contenteditable="true"]')) return
      if (e.key.length !== 1 && e.key !== 'Backspace' && e.key !== 'Enter') return
      e.preventDefault()
      onKey(e.key)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onKey])

  return (
    <div className="flex flex-col gap-2">
      {capsOn && (
        <div className="rounded-md bg-surface px-3 py-1.5 text-center text-sm font-medium text-error">
          ⚠ Caps Lock is on
        </div>
      )}
      <div
        ref={containerRef}
        // Font comes from user preferences (--font-test); the rest of the UI
        // stays in Nunito.
        style={{ fontFamily: 'var(--font-test)' }}
        className="relative max-h-40 overflow-hidden rounded-lg bg-surface p-6 text-2xl leading-relaxed tracking-wide"
      >
        <div
          ref={caretRef}
          className="pointer-events-none absolute left-0 top-0 h-9 w-0.5 bg-accent transition-transform duration-75"
          style={{ willChange: 'transform' }}
        />
        <div className="select-none whitespace-pre-wrap break-words">
          {[...target].map((ch, i) => (
            <span
              key={i}
              ref={(el) => {
                charRefs.current[i] = el
              }}
              className={charClass(charStates[i])}
            >
              {ch}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
