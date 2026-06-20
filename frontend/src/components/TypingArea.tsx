import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
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
  const inputRef = useRef<HTMLInputElement>(null)
  const [capsOn, setCapsOn] = useState(false)
  // Touch devices have no physical keyboard; we summon the soft keyboard via a
  // hidden input and read its beforeinput events (§22).
  const [isTouch] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches,
  )
  const [focused, setFocused] = useState(false)

  // Caret position: plain CSS transform, no animation library. Must be instant.
  // Use the span's offset coords (relative to the position:relative container),
  // not getBoundingClientRect: the caret is an absolutely-positioned child that
  // scrolls together with the text, so content coordinates keep it aligned even
  // after scrollIntoView scrolls the box (viewport coords would lag by scrollTop).
  useLayoutEffect(() => {
    const container = containerRef.current
    const caret = caretRef.current
    if (!container || !caret) return

    const atEnd = index >= target.length
    const span = charRefs.current[atEnd ? target.length - 1 : index]
    if (!span) return

    const x = atEnd ? span.offsetLeft + span.offsetWidth : span.offsetLeft
    const y = span.offsetTop
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

  // Soft-keyboard input: keydown is unreliable on mobile (keyCode 229), so read
  // beforeinput instead. Each inserted char (or a backspace) maps to onKey.
  const handleBeforeInput = (e: FormEvent<HTMLInputElement>) => {
    const ie = e.nativeEvent as InputEvent
    e.preventDefault()
    if (ie.inputType === 'deleteContentBackward') {
      onKey('Backspace')
      return
    }
    const data = ie.data
    if (data) for (const ch of data) onKey(ch)
  }

  return (
    <div className="flex flex-col gap-2">
      {capsOn && (
        <div className="rounded-md bg-surface px-3 py-1.5 text-center text-sm font-medium text-error">
          ⚠ Caps Lock is on
        </div>
      )}
      {/* Off-screen input used only to raise the soft keyboard on touch devices. */}
      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        aria-hidden
        tabIndex={-1}
        value=""
        onChange={() => {}}
        onBeforeInput={handleBeforeInput}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="pointer-events-none absolute h-px w-px opacity-0"
      />
      <div
        ref={containerRef}
        // Font comes from user preferences (--font-test); the rest of the UI
        // stays in Nunito.
        style={{ fontFamily: 'var(--font-test)' }}
        onClick={isTouch ? () => inputRef.current?.focus() : undefined}
        className="relative max-h-40 overflow-hidden rounded-lg bg-surface p-6 text-2xl leading-relaxed tracking-wide"
      >
        {isTouch && !focused && (
          <button
            type="button"
            onClick={() => inputRef.current?.focus()}
            className="absolute inset-0 z-10 flex items-center justify-center bg-surface/80 text-sm font-medium text-muted backdrop-blur-sm"
          >
            Tap to type
          </button>
        )}
        <div
          ref={caretRef}
          // `fk-caret` lets the equipped caret cosmetic restyle this via CSS
          // (data-caret on <html>) without touching the transform-driven motion.
          className="fk-caret pointer-events-none absolute left-0 top-0 h-9 w-0.5 bg-accent transition-transform duration-75"
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
