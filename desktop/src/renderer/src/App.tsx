import { useEffect, useState } from 'react'

import { useCanvasRealtime } from './canvas/hooks/use-canvas-realtime'
import { cn } from './lib/cn'

type HealthState = 'checking' | 'ok' | 'degraded' | 'failed'

/**
 * Renders the desktop renderer shell and main-process health indicator.
 * @returns The root ComicCanvas renderer element.
 * @throws Error never intentionally; health failures are represented in UI state.
 */
export function App(): JSX.Element {
  const [health, setHealth] = useState<HealthState>('checking')
  useCanvasRealtime()

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
    <main className="flex min-h-screen items-stretch bg-bg-base text-text-base">
      <section className="flex min-h-screen w-full flex-col items-start justify-between gap-6 bg-bg-base p-5 md:flex-row md:p-8">
        <div>
          <p className="mb-2 text-[13px] font-bold uppercase text-text-muted">ComicCanvas Studio</p>
          <h1 className="m-0 text-[26px] font-bold leading-tight md:text-[32px]">AIGC comic-drama canvas</h1>
          <p className="mt-3.5 max-w-[720px] text-[15px] leading-relaxed text-text-secondary">
            M1 desktop shell is ready for the local canvas, durable jobs, assets, gateway providers, and agent orchestration runtime.
          </p>
        </div>
        <div
          className="inline-flex h-9 min-w-[132px] items-center justify-center gap-2 rounded-md border border-border-secondary bg-bg-card text-[13px] font-semibold text-text-base"
          aria-label="Main process health"
        >
          <span
            className={cn(
              'h-2 w-2 rounded-pill bg-text-muted',
              health === 'ok' && 'bg-semantic-success',
              health === 'failed' && 'bg-semantic-negative',
              health === 'degraded' && 'bg-semantic-warning'
            )}
            data-state={health}
          />
          <span>{health}</span>
        </div>
      </section>
    </main>
  )
}
