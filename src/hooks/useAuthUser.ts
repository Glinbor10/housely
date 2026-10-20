import { useMemo, useSyncExternalStore } from 'react'
import type { AuthUserInfo } from '../firebase/googleAccess'
import { createSubscriptionStore } from './subscriptionStore'

// The account of this device, kept live: it changes when an anonymous account is linked to Google.
// `subscribe` must be a stable function (it identifies the store).
export const useAuthUser = (
  subscribe: (onChange: (user: AuthUserInfo | null) => void) => () => void,
): AuthUserInfo | null => {
  const store = useMemo(
    () => createSubscriptionStore<AuthUserInfo | null>((onValue) => subscribe(onValue), null),
    [subscribe],
  )
  return useSyncExternalStore(store.subscribe, store.getSnapshot).value
}
