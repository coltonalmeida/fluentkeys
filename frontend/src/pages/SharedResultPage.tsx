import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ReplayPlayer } from '../components/ReplayPlayer'
import { getSharedResult, getTrace, type SharedResult, type Trace } from '../lib/api'
import { DIFFICULTIES, KEY_SETS, type Difficulty, type KeySetId } from '../lib/words'

const keySetLabel = (id: string) => KEY_SETS[id as KeySetId]?.label ?? id
const difficultyLabel = (id: string) => DIFFICULTIES[id as Difficulty]?.label ?? id

/** Interactive view of a shared result at /r/:id (§1). Public — no auth. */
export function SharedResultPage() {
  const { id = '' } = useParams()
  const [result, setResult] = useState<SharedResult | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound'>('loading')
  const [trace, setTrace] = useState<Trace | null>(null)
  const [replayOpen, setReplayOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    getSharedResult(id)
      .then((r) => {
        if (cancelled) return
        setResult(r)
        setStatus('ready')
      })
      .catch(() => !cancelled && setStatus('notfound'))
    // Trace is optional (older results may not have one).
    getTrace(id)
      .then((r) => !cancelled && setTrace(r.trace))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [id])

  if (status === 'loading') return <p className="text-sm text-muted">Loading…</p>
  if (status === 'notfound' || !result) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">That result link is invalid or expired.</p>
        <Link to="/test" className="text-sm text-accent underline">
          Take a typing test
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col items-center gap-6 rounded-lg bg-surface p-10 text-center">
        <div className="text-sm uppercase tracking-wider text-muted">
          {result.username ? `${result.username}'s result` : 'Anonymous result'}
        </div>
        <div className="flex flex-wrap justify-center gap-12">
          <div>
            <div className="text-6xl font-bold text-accent">{Math.round(result.wpm)}</div>
            <div className="mt-1 text-sm uppercase tracking-wider text-muted">WPM</div>
          </div>
          <div>
            <div className="text-6xl font-bold text-fg">{result.accuracy.toFixed(1)}%</div>
            <div className="mt-1 text-sm uppercase tracking-wider text-muted">Accuracy</div>
          </div>
        </div>
        <div className="text-sm text-muted">
          {keySetLabel(result.keySet)} · {difficultyLabel(result.difficulty)} · {result.duration}s
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/test"
            className="rounded-md bg-accent px-6 py-2.5 font-semibold text-accent-contrast hover:bg-accent/90"
          >
            Beat this score
          </Link>
          {trace && (
            <button
              type="button"
              onClick={() => setReplayOpen(true)}
              className="rounded-md border border-border px-6 py-2.5 text-sm text-fg transition-colors hover:bg-surface-2"
            >
              Watch replay
            </button>
          )}
          {result.username && (
            <Link
              to={`/u/${encodeURIComponent(result.username)}`}
              className="rounded-md border border-border px-6 py-2.5 text-sm text-fg transition-colors hover:bg-surface-2"
            >
              View profile
            </Link>
          )}
        </div>
      </section>

      {replayOpen && trace && <ReplayPlayer trace={trace} onClose={() => setReplayOpen(false)} />}
    </div>
  )
}
