// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SubscriptionSource } from './subscriptionStore'
import { useSubscription } from './useSubscription'

const createSource = () => {
  let push: (value: number) => void = () => {}
  const close = vi.fn()
  const open = vi.fn<SubscriptionSource<number>>((onValue) => {
    push = onValue
    return close
  })
  return { open, close, push: (value: number) => push(value) }
}

describe('useSubscription', () => {
  it('returns the initial value until the source delivers', () => {
    const source = createSource()
    const { result } = renderHook(() => useSubscription('a', source.open, 0))
    expect(result.current).toEqual({ value: 0, error: null, ready: false })
  })

  it('re-renders with every value pushed by the source', () => {
    const source = createSource()
    const { result } = renderHook(() => useSubscription('a', source.open, 0))
    act(() => source.push(7))
    expect(result.current.value).toBe(7)
    expect(result.current.ready).toBe(true)
  })

  it('closes the source when the component unmounts', () => {
    const source = createSource()
    const { unmount } = renderHook(() => useSubscription('a', source.open, 0))
    unmount()
    expect(source.close).toHaveBeenCalledTimes(1)
  })

  it('opens a new source when the key changes', () => {
    const first = createSource()
    const second = createSource()
    const { rerender } = renderHook(({ key, source }) => useSubscription(key, source.open, 0), {
      initialProps: { key: 'a', source: first },
    })
    rerender({ key: 'b', source: second })
    expect(first.close).toHaveBeenCalledTimes(1)
    expect(second.open).toHaveBeenCalledTimes(1)
  })
})
