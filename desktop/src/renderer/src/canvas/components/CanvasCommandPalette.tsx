/**
 * Lightweight canvas command palette.
 * @see docs/api-contracts/canvas-plan.md
 */

import { useCallback, useMemo, useState, type KeyboardEvent } from 'react'
import { Search } from 'lucide-react'

export interface CanvasCommand {
  id: string
  label: string
  keywords?: string[]
  disabled?: boolean
  run: () => void
}

export interface CanvasCommandPaletteProps {
  open: boolean
  commands: CanvasCommand[]
  onClose: () => void
}

function commandMatches(command: CanvasCommand, query: string): boolean {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return [command.label, ...(command.keywords ?? [])]
    .some((value) => value.toLowerCase().includes(normalized))
}

/**
 * Renders a searchable command palette for canvas operations.
 * @returns Command palette overlay or null when closed.
 * @see docs/api-contracts/canvas-plan.md
 */
export function CanvasCommandPalette({ open, commands, onClose }: CanvasCommandPaletteProps): JSX.Element | null {
  const [query, setQuery] = useState('')
  const filteredCommands = useMemo(
    () => commands.filter((command) => commandMatches(command, query)),
    [commands, query],
  )

  const runCommand = useCallback((command: CanvasCommand) => {
    if (command.disabled) return
    command.run()
    setQuery('')
    onClose()
  }, [onClose])

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setQuery('')
      onClose()
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const firstEnabled = filteredCommands.find((command) => !command.disabled)
      if (firstEnabled) runCommand(firstEnabled)
    }
  }, [filteredCommands, onClose, runCommand])

  if (!open) return null

  return (
    <div className="nodrag nowheel fixed inset-0 z-[9998] flex items-start justify-center bg-black/30 px-4 pt-[12vh]">
      <div className="w-full max-w-[520px] overflow-hidden rounded-xl border border-border-primary bg-bg-panel shadow-pop">
        <div className="flex items-center gap-2 border-b border-border-secondary px-3 py-2">
          <Search className="h-4 w-4 text-text-muted" />
          <input
            autoFocus
            role="searchbox"
            aria-label="Search canvas commands"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search canvas commands"
            className="h-9 min-w-0 flex-1 bg-transparent text-[14px] text-text-base outline-none placeholder:text-text-muted"
          />
          <button
            type="button"
            onClick={() => {
              setQuery('')
              onClose()
            }}
            className="rounded-md px-2 py-1 text-[12px] text-text-muted transition-colors hover:bg-bg-hover hover:text-text-base"
          >
            Esc
          </button>
        </div>

        <div className="max-h-[320px] overflow-y-auto p-1.5">
          {filteredCommands.length === 0 ? (
            <div className="px-3 py-6 text-center text-[13px] text-text-muted">
              No matching commands
            </div>
          ) : filteredCommands.map((command) => (
            <button
              key={command.id}
              type="button"
              disabled={command.disabled}
              onClick={() => runCommand(command)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] text-text-base transition-colors hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span>{command.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
