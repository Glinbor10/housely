import { describe, expect, it, vi } from 'vitest'
import { createAccountNoticeStore } from './accountNoticeStore'

describe('the notice of the homes after switching account', () => {
  it('starts empty and tells its listeners when it changes', () => {
    const store = createAccountNoticeStore()
    const listener = vi.fn()
    store.subscribe(listener)
    expect(store.getSnapshot()).toEqual({ broughtAlong: [], leftBehind: [], switches: 0 })
    store.set({ broughtAlong: ['Piso grande'], leftBehind: [] })
    expect(store.getSnapshot().broughtAlong).toEqual(['Piso grande'])
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('is still there for a screen that starts after it was set', () => {
    const store = createAccountNoticeStore()
    store.set({ broughtAlong: ['A'], leftBehind: ['B'] })
    expect(store.getSnapshot()).toEqual({ broughtAlong: ['A'], leftBehind: ['B'], switches: 1 })
  })

  it('counts each switch, so a home that failed in the middle of one starts again', () => {
    const store = createAccountNoticeStore()
    store.set({ broughtAlong: [], leftBehind: [] })
    store.set({ broughtAlong: ['A'], leftBehind: [] })
    expect(store.getSnapshot().switches).toBe(2)
    store.dismiss('broughtAlong')
    expect(store.getSnapshot().switches).toBe(2)
  })

  it('closes one notice without touching the other', () => {
    const store = createAccountNoticeStore()
    store.set({ broughtAlong: ['A'], leftBehind: ['B'] })
    store.dismiss('broughtAlong')
    expect(store.getSnapshot()).toEqual({ broughtAlong: [], leftBehind: ['B'], switches: 1 })
  })

  it('stops telling a listener that unsubscribed', () => {
    const store = createAccountNoticeStore()
    const listener = vi.fn()
    store.subscribe(listener)()
    store.set({ broughtAlong: ['A'], leftBehind: [] })
    expect(listener).not.toHaveBeenCalled()
  })
})
