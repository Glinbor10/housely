export interface SubscriptionSnapshot<T> {
  value: T
  error: Error | null
  // False until the source has delivered its first value
  ready: boolean
}

export type SubscriptionSource<T> = (
  onValue: (value: T) => void,
  onError: (error: Error) => void,
) => () => void

// External store for useSyncExternalStore: opens the source on the first listener and closes it
// on the last, and keeps the snapshot object stable until something changes.
export const createSubscriptionStore = <T>(source: SubscriptionSource<T>, initial: T) => {
  let snapshot: SubscriptionSnapshot<T> = { value: initial, error: null, ready: false }
  let closeSource: (() => void) | null = null
  const listeners = new Set<() => void>()

  const publish = (next: SubscriptionSnapshot<T>) => {
    snapshot = next
    listeners.forEach((listener) => listener())
  }

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener)
    if (listeners.size === 1) {
      closeSource = source(
        (value) => publish({ value, error: null, ready: true }),
        (error) => publish({ ...snapshot, error }),
      )
    }
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) {
        closeSource?.()
        closeSource = null
      }
    }
  }

  return { subscribe, getSnapshot: () => snapshot }
}
