import { useLayoutEffect, useRef } from 'react'
import type { CharState } from '../hooks/useTypingTest'

interface TypingAreaProps {
  target: string
  charStates: CharState[]
  index: number
  onKey: (key: string) => void
}

const charClass = (state: CharState | undefined): string => {
  if (state === 'correct') return 'text-zinc-100'
  if (state === 'incorrect') return 'text-red-400 underline decoration-red-400'
  return 'text-zinc-500'
}

export function TypingArea({ target, charStates, index, onKey }: TypingAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const caretRef = useRef<HTMLDivElement>(null)
  const charRefs = useRef<(HTMLSpanElement | null)[]>([])

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

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      autoFocus
      onKeyDown={(e) => {
        if (e.key === 'Tab') return
        e.preventDefault()
        onKey(e.key)
      }}
      className="relative max-h-40 overflow-hidden rounded-lg bg-zinc-800/50 p-6 font-mono text-2xl leading-relaxed tracking-wide outline-none focus:ring-2 focus:ring-emerald-500/50"
    >
      <div
        ref={caretRef}
        className="pointer-events-none absolute left-0 top-0 h-9 w-0.5 bg-emerald-400 transition-transform duration-75"
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
  )
}
