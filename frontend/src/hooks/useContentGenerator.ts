import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { eligibleWords, generateLine, type LineOptions } from '../lib/contentGen'

export interface ContentGeneratorParams {
  unlocked: string[]
  strength: Record<string, number>
  /** Most recently unlocked letter; boosted while `boostNewest` is true. */
  newestLetter: string | null
  /** Whether the newest letter still gets its 2× exposure boost. */
  boostNewest: boolean
  /** Per-key miss counts from timed-test history (§25) — extra weak-key bias. */
  missCounts?: Record<string, number>
}

export interface UseContentGenerator {
  currentLine: string
  nextLine: string
  /** Promote the pre-generated next line to current and generate a new next. */
  advanceLine: () => void
  /** Regenerate the upcoming line in place (after an unlock changes the pool). */
  refreshNext: () => void
}

/**
 * Generates practice lines from the live unlocked set + strengths. The latest
 * generation options and next line are mirrored into refs (via effects, not
 * during render) so `advanceLine`/`refreshNext` stay referentially stable yet
 * always read fresh data.
 */
export function useContentGenerator(params: ContentGeneratorParams): UseContentGenerator {
  // Re-filtering the 9k word list is only worth doing when the unlocked set
  // changes, so memoize on the joined unlocked letters.
  const unlockedKey = params.unlocked.join('')
  // eslint-disable-next-line react-hooks/exhaustive-deps -- unlockedKey is the stable key for params.unlocked
  const eligible = useMemo(() => eligibleWords(params.unlocked), [unlockedKey])

  const opts: LineOptions = {
    unlocked: params.unlocked,
    strength: params.strength,
    newestLetter: params.newestLetter,
    boostNewest: params.boostNewest,
    eligible,
    missCounts: params.missCounts,
  }

  const optsRef = useRef(opts)
  useEffect(() => {
    optsRef.current = opts
  })

  const [currentLine, setCurrentLine] = useState(() => generateLine(opts))
  const [nextLine, setNextLine] = useState(() => generateLine(opts))

  // Mirror the latest next line so the stable advanceLine can promote it.
  const nextLineRef = useRef(nextLine)
  useEffect(() => {
    nextLineRef.current = nextLine
  }, [nextLine])

  const advanceLine = useCallback(() => {
    const promoted = nextLineRef.current
    const fresh = generateLine(optsRef.current)
    nextLineRef.current = fresh
    setCurrentLine(promoted)
    setNextLine(fresh)
  }, [])

  const refreshNext = useCallback(() => {
    const fresh = generateLine(optsRef.current)
    nextLineRef.current = fresh
    setNextLine(fresh)
  }, [])

  return { currentLine, nextLine, advanceLine, refreshNext }
}
