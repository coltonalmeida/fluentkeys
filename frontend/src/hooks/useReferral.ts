import { useAuth } from '@clerk/clerk-react'
import { useEffect, useRef } from 'react'
import { redeemReferral } from '../lib/api'

const REF_KEY = 'fluentkeys.ref'

/**
 * Referral capture + redemption (§4). Stashes a `?ref=CODE` query param (works
 * while signed out), then redeems it once the user is signed in and clears it.
 */
export function useReferral() {
  const { isSignedIn, getToken } = useAuth()
  const handled = useRef(false)

  // Capture ?ref=CODE on first load.
  useEffect(() => {
    try {
      const code = new URLSearchParams(window.location.search).get('ref')
      if (code) localStorage.setItem(REF_KEY, code)
    } catch {
      /* storage disabled — referral just won't persist */
    }
  }, [])

  // Redeem once signed in.
  useEffect(() => {
    if (!isSignedIn || handled.current) return
    let code: string | null = null
    try {
      code = localStorage.getItem(REF_KEY)
    } catch {
      /* ignore */
    }
    if (!code) return
    handled.current = true
    getToken()
      .then((t) => redeemReferral(t, code))
      .then(() => {
        try {
          localStorage.removeItem(REF_KEY)
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        handled.current = false // allow a retry next session
      })
  }, [isSignedIn, getToken])
}
