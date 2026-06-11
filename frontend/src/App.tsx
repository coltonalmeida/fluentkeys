import { useEffect, useState } from 'react'

type HealthState = 'loading' | 'ok' | 'error'

function App() {
  const [health, setHealth] = useState<HealthState>('loading')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then(() => setHealth('ok'))
      .catch(() => setHealth('error'))
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-zinc-900 text-zinc-100">
      <h1 className="text-4xl font-bold">FluentKeys</h1>
      <p className="text-zinc-400">
        Backend:{' '}
        {health === 'loading' && <span className="text-yellow-400">checking…</span>}
        {health === 'ok' && <span className="text-green-400">connected</span>}
        {health === 'error' && <span className="text-red-400">unreachable</span>}
      </p>
    </div>
  )
}

export default App
