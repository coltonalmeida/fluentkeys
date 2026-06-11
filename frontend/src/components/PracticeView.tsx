import { useCallback, useEffect, useRef, useState } from 'react'
import { CHAR_TO_KEY } from '../lib/keyboard'
import { generateWords } from '../lib/selectWords'
import { computeStats } from '../lib/stats'
import { KeyboardVisual } from './KeyboardVisual'

/**
 * Set to a string to practice fixed text (supports shifted chars, e.g.
 * "Hello, World!"). Leave null to generate words from the static lists.
 */
export const PRACTICE_TEXT: string | null = null

const newText = () =>
  PRACTICE_TEXT ?? generateWords(12, { keySet: 'all', difficulty: 'medium' }).join(' ')

const FLASH_MS = 200

export function PracticeView() {
  const [text, setText] = useState(newText)
  const [index, setIndex] = useState(0)
  const [flashKeyId, setFlashKeyId] = useState<string | null>(null)
  const [keystrokes, setKeystrokes] = useState({ correct: 0, incorrect: 0 })
  const startRef = useRef<number | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const done = index >= text.length
  const stats = done
    ? computeStats(
        keystrokes.correct,
        keystrokes.incorrect,
        keystrokes.correct + keystrokes.incorrect,
        startRef.current !== null ? (performance.now() - startRef.current) / 1000 : 0,
      )
    : null

  const reset = useCallback(() => {
    setText(newText())
    setIndex(0)
    setKeystrokes({ correct: 0, incorrect: 0 })
    setFlashKeyId(null)
    startRef.current = null
  }, [])

  useEffect(() => {
    if (done) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key.length !== 1) return // ignore Shift, Backspace, F-keys, etc.
      e.preventDefault()
      if (startRef.current === null) startRef.current = performance.now()
      if (e.key === text[index]) {
        setKeystrokes((s) => ({ ...s, correct: s.correct + 1 }))
        setIndex((i) => i + 1)
      } else {
        setKeystrokes((s) => ({ ...s, incorrect: s.incorrect + 1 }))
        const pressed = CHAR_TO_KEY[e.key]
        if (pressed) {
          setFlashKeyId(pressed.keyId)
          if (flashTimer.current) clearTimeout(flashTimer.current)
          flashTimer.current = setTimeout(() => setFlashKeyId(null), FLASH_MS)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [done, text, index])

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current)
  }, [])

  const nextChar = done ? null : (text[index] ?? null)

  return (
    <div className="flex flex-col items-center gap-8 py-4">
      <PracticeText text={text} index={index} />
      {done && stats ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">Done!</p>
          <p className="font-mono text-zinc-700 dark:text-zinc-300">
            {stats.wpm} wpm · {stats.accuracy}% accuracy
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-emerald-400"
          >
            Go again
          </button>
        </div>
      ) : (
        <KeyboardVisual nextChar={nextChar} flashKeyId={flashKeyId} />
      )}
    </div>
  )
}

function PracticeText({ text, index }: { text: string; index: number }) {
  return (
    <p className="max-w-3xl text-center font-mono text-2xl leading-relaxed tracking-wide">
      {[...text].map((ch, i) => {
        const display = ch === ' ' ? '·' : ch
        const cls =
          i < index
            ? ch === ' '
              ? 'text-zinc-400 dark:text-zinc-600'
              : 'text-zinc-900 dark:text-zinc-100'
            : i === index
              ? 'text-zinc-900 dark:text-zinc-100 underline decoration-emerald-500 dark:decoration-emerald-400 decoration-2 underline-offset-4'
              : ch === ' '
                ? 'text-zinc-400 dark:text-zinc-600'
                : 'text-zinc-400 dark:text-zinc-500'
        return (
          <span key={i} className={cls}>
            {display}
          </span>
        )
      })}
    </p>
  )
}
