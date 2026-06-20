import type { ReactNode } from 'react'

interface TooltipProps {
  label: string
  children: ReactNode
  /** Which side the tooltip appears on (default top). */
  side?: 'top' | 'bottom'
  /** Extra classes for the wrapper (e.g. layout helpers like flex-1). */
  className?: string
}

/**
 * Lightweight themed hover tooltip — a styled replacement for native `title`
 * attributes (which look out of place against the custom cursor). Pure CSS
 * (group-hover); `z-[70]` keeps it above content/modals but below the cursor.
 */
export function Tooltip({ label, children, side = 'top', className = '' }: TooltipProps) {
  const pos = side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
  return (
    <span className={`group relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 ${pos} z-[70] -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-fg opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100`}
      >
        {label}
      </span>
    </span>
  )
}
