import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { ResultsScreen } from '../components/ResultsScreen'
import { TypingArea } from '../components/TypingArea'
import { useHotkeys } from '../hooks/useHotkeys'
import { usePreferences } from '../hooks/usePreferences'
import { useTypingTest, type TestSettings } from '../hooks/useTypingTest'

/** Minimal embeddable typing test (§5). Rendered outside the app shell (no nav)
 *  so bloggers can iframe it via /embed.js; links back to the full app. */
export function EmbedPage() {
  const { prefs } = usePreferences()
  const [settings] = useState<TestSettings>({
    keySet: 'all',
    difficulty: 'medium',
    duration: 30,
    mode: 'words',
    codeLanguage: prefs.codeLanguage,
  })
  const test = useTypingTest(settings)
  useHotkeys({ restart: test.restart })

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-bg p-4 text-fg">
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold text-accent">FluentKeys</span>
        <span className="font-mono tabular-nums text-muted">
          {test.status === 'running' && (
            <span className="mr-3">
              <span className="text-accent">{test.liveWpm}</span> wpm
            </span>
          )}
          {test.status === 'running' ? `${test.timeLeft}s` : `${settings.duration}s`}
        </span>
      </div>

      <div className="min-h-[8rem]">
        <AnimatePresence mode="wait">
          {test.status === 'finished' && test.stats ? (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ResultsScreen
                stats={test.stats}
                timeline={test.timeline}
                missCounts={test.missCounts}
                onRestart={test.restart}
              />
            </motion.div>
          ) : (
            <motion.div key="test" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
              <TypingArea target={test.target} charStates={test.charStates} index={test.index} onKey={test.handleKey} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-auto text-center text-xs text-muted">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline transition-colors hover:text-accent"
        >
          Powered by FluentKeys — take the full typing test →
        </a>
      </div>
    </div>
  )
}
