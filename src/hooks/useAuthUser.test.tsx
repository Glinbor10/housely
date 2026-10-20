// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AuthUserInfo } from '../firebase/googleAccess'
import { useAuthUser } from './useAuthUser'

const anonymous: AuthUserInfo = { uid: 'u1', isAnonymous: true, providerIds: [] }
const google: AuthUserInfo = { uid: 'u1', isAnonymous: false, providerIds: ['google.com'] }

const createSource = () => {
  let push: (user: AuthUserInfo | null) => void = () => {}
  const unsubscribe = vi.fn()
  const subscribe = vi.fn((onChange: (user: AuthUserInfo | null) => void) => {
    push = onChange
    return unsubscribe
  })
  return { subscribe, unsubscribe, push: (user: AuthUserInfo | null) => push(user) }
}

describe('useAuthUser', () => {
  it('starts without a user until the account is known', () => {
    const source = createSource()
    const { result } = renderHook(() => useAuthUser(source.subscribe))
    expect(result.current).toBeNull()
  })

  it('follows the account, including the moment it becomes a Google account', () => {
    const source = createSource()
    const { result } = renderHook(() => useAuthUser(source.subscribe))
    act(() => source.push(anonymous))
    expect(result.current).toEqual(anonymous)
    act(() => source.push(google))
    expect(result.current).toEqual(google)
  })

  it('stops listening when the component goes away', () => {
    const source = createSource()
    const { unmount } = renderHook(() => useAuthUser(source.subscribe))
    unmount()
    expect(source.unsubscribe).toHaveBeenCalledTimes(1)
  })
})
