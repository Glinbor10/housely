import { describe, expect, it, vi } from 'vitest'
import { createSubscriptionStore } from './subscriptionStore'

// A fake source that lets the test push values and errors.
const createSource = () => {
  let onValue: (value: number) => void = () => {}
  let onError: (error: Error) => void = () => {}
  const close = vi.fn()
  const open = vi.fn(
    (valueCallback: (value: number) => void, errorCallback: (error: Error) => void) => {
      onValue = valueCallback
      onError = errorCallback
      return close
    },
  )
  return {
    open,
    close,
    push: (value: number) => onValue(value),
    fail: (error: Error) => onError(error),
  }
}

describe('createSubscriptionStore', () => {
  it('starts with the initial value and no error', () => {
    const store = createSubscriptionStore(createSource().open, 0)
    expect(store.getSnapshot()).toEqual({ value: 0, error: null, ready: false })
  })

  it('opens the source on the first listener only', () => {
    const source = createSource()
    const store = createSubscriptionStore(source.open, 0)
    store.subscribe(() => {})
    store.subscribe(() => {})
    expect(source.open).toHaveBeenCalledTimes(1)
  })

  it('closes the source when the last listener leaves', () => {
    const source = createSource()
    const store = createSubscriptionStore(source.open, 0)
    const first = store.subscribe(() => {})
    const second = store.subscribe(() => {})
    first()
    expect(source.close).not.toHaveBeenCalled()
    second()
    expect(source.close).toHaveBeenCalledTimes(1)
  })

  it('publishes values to every listener and marks the store ready', () => {
    const source = createSource()
    const store = createSubscriptionStore(source.open, 0)
    const listenerA = vi.fn()
    const listenerB = vi.fn()
    store.subscribe(listenerA)
    store.subscribe(listenerB)
    source.push(5)
    expect(store.getSnapshot()).toEqual({ value: 5, error: null, ready: true })
    expect(listenerA).toHaveBeenCalledTimes(1)
    expect(listenerB).toHaveBeenCalledTimes(1)
  })

  it('returns the same snapshot object until something changes', () => {
    const source = createSource()
    const store = createSubscriptionStore(source.open, 0)
    store.subscribe(() => {})
    source.push(1)
    expect(store.getSnapshot()).toBe(store.getSnapshot())
  })

  it('keeps the last value and exposes the error', () => {
    const source = createSource()
    const store = createSubscriptionStore(source.open, 0)
    store.subscribe(() => {})
    source.push(3)
    source.fail(new Error('denied'))
    expect(store.getSnapshot().value).toBe(3)
    expect(store.getSnapshot().error?.message).toBe('denied')
  })

  it('reopens the source when a listener comes back after all left', () => {
    const source = createSource()
    const store = createSubscriptionStore(source.open, 0)
    store.subscribe(() => {})()
    store.subscribe(() => {})
    expect(source.open).toHaveBeenCalledTimes(2)
  })

  it('stops notifying a listener that left', () => {
    const source = createSource()
    const store = createSubscriptionStore(source.open, 0)
    const listener = vi.fn()
    const leave = store.subscribe(listener)
    store.subscribe(() => {})
    leave()
    source.push(9)
    expect(listener).not.toHaveBeenCalled()
  })
})
