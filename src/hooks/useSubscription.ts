import { useMemo, useSyncExternalStore } from 'react'
import {
  createSubscriptionStore,
  type SubscriptionSnapshot,
  type SubscriptionSource,
} from './subscriptionStore'

// Subscribes a component to a source without useEffect. The store is recreated only when the key
// changes (for example, a different flat).
export const useSubscription = <T>(
  key: string,
  source: SubscriptionSource<T>,
  initial: T,
): SubscriptionSnapshot<T> => {
  // The source and the initial value are tied to the key: the store must not change on every render.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  const store = useMemo(() => createSubscriptionStore(source, initial), [key])
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}
