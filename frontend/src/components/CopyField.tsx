import { useState } from 'react'

/** A read-only value with a copy button + transient "Copied!" state. */
export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm">
      <span className="truncate text-muted" title={value}>
        {value}
      </span>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard
            ?.writeText(value)
            .then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            })
            .catch(() => {})
        }}
        className="shrink-0 rounded bg-accent px-2 py-1 text-xs font-semibold text-accent-contrast hover:bg-accent/90"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}
