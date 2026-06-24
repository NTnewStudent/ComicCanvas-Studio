import { useEffect, useState } from 'react'

type HealthState = 'checking' | 'ok' | 'degraded' | 'failed'

export function App(): JSX.Element {
  const [health, setHealth] = useState<HealthState>('checking')

  useEffect(() => {
    let isMounted = true

    window.comicCanvas.health()
      .then((result) => {
        if (isMounted) {
          setHealth(result.status)
        }
      })
      .catch(() => {
        if (isMounted) {
          setHealth('failed')
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <main className="app-shell">
      <section className="workspace-band">
        <div>
          <p className="eyebrow">ComicCanvas Studio</p>
          <h1>AIGC comic-drama canvas</h1>
          <p className="summary">M1 desktop shell is ready for the local canvas, durable jobs, assets, gateway providers, and agent orchestration runtime.</p>
        </div>
        <div className="status-panel" aria-label="Main process health">
          <span className="status-dot" data-state={health} />
          <span>{health}</span>
        </div>
      </section>
    </main>
  )
}
