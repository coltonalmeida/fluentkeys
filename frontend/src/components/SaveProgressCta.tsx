import { SignedOut, SignUpButton } from '@clerk/clerk-react'
import { useClerkAppearance } from '../hooks/useClerkAppearance'

/** Post-run nudge for signed-out users to claim their stats (§19). Renders
 *  nothing for signed-in users. */
export function SaveProgressCta() {
  const clerkAppearance = useClerkAppearance()
  return (
    <SignedOut>
      <div className="flex w-full max-w-md flex-col items-center gap-2 rounded-lg border border-accent/30 bg-surface-2 px-5 py-4 text-center">
        <p className="text-sm font-semibold text-fg">Save your progress</p>
        <p className="text-xs text-muted">
          You're playing as a guest — create a free account to keep your stats, personal bests, and
          streak across devices.
        </p>
        <SignUpButton mode="modal" appearance={clerkAppearance}>
          <button
            type="button"
            className="mt-1 rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent/90"
          >
            Claim your stats
          </button>
        </SignUpButton>
      </div>
    </SignedOut>
  )
}
