import { useAuth, SignInButton, SignUpButton } from '@clerk/clerk-react'
import { motion } from 'framer-motion'
import { useState } from 'react'

interface AccountPromptProps {
  /** Tailors the copy to where the prompt appears. */
  context: 'profile' | 'leaderboard'
}

// One shared flag, in sessionStorage so it resets next browser session (matching
// anonymous data lifetime): once a user picks "Maybe later" we don't nag again
// this session, on either page.
const DISMISS_KEY = 'fluentkeys.account-prompt-dismissed'

const COPY = {
  profile: {
    title: 'Save your progress',
    body: "You're browsing without an account, so your stats reset when this session ends. Create an account to keep your progress, personal bests, and history across devices.",
  },
  leaderboard: {
    title: 'Join the leaderboard',
    body: 'Only players with an account appear on the leaderboard. Create one to post your scores and compete — your stats also save across sessions.',
  },
} as const

/**
 * Non-blocking sign-up nudge shown to anonymous users on the Profile and
 * Leaderboard pages. Declining ("Maybe later") closes it and lets them keep
 * viewing the page; the choice is remembered for the session. Renders nothing for
 * signed-in users or once dismissed.
 */
export function AccountPrompt({ context }: AccountPromptProps) {
  const { isSignedIn } = useAuth()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  if (isSignedIn || dismissed) return null

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Storage disabled — fall back to in-memory dismissal for this mount.
    }
    setDismissed(true)
  }

  const { title, body } = COPY[context]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-2xl"
      >
        <h2 className="mb-2 text-center text-xl font-bold text-fg">{title}</h2>
        <p className="mb-6 text-center text-sm text-muted">{body}</p>

        <div className="flex flex-col gap-2">
          <SignUpButton mode="modal">
            <button
              type="button"
              className="w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-contrast transition-colors hover:bg-accent/90"
            >
              Create account
            </button>
          </SignUpButton>

          <SignInButton mode="modal">
            <button
              type="button"
              className="w-full rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              I already have an account
            </button>
          </SignInButton>

          <button
            type="button"
            onClick={dismiss}
            className="mt-1 w-full text-sm text-muted underline transition-colors hover:text-fg"
          >
            Maybe later
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
