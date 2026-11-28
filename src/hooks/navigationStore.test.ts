// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createNavigationStore } from './navigationStore'

interface Place {
  tab: string
  open: boolean
}
const home: Place = { tab: 'week', open: false }
const isPlace = (value: unknown): value is Place =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Place).tab === 'string' &&
  typeof (value as Place).open === 'boolean'

// The browser tells the page that it went back, a moment after history.back()
const back = () =>
  new Promise<void>((resolve) => {
    window.addEventListener('popstate', () => resolve(), { once: true })
    window.history.back()
  })

afterEach(() => window.history.replaceState(null, ''))

describe('navigation store', () => {
  it('starts in the initial place', () => {
    expect(createNavigationStore('flat-a', home, isPlace).getSnapshot()).toEqual(home)
  })

  it('goes to a new place and tells the ones that follow it', () => {
    const store = createNavigationStore('flat-a', home, isPlace)
    const listener = vi.fn()
    store.subscribe(listener)
    store.go({ tab: 'flat', open: true })
    expect(store.getSnapshot()).toEqual({ tab: 'flat', open: true })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('does not add an entry to the history when it is already in that place', () => {
    const store = createNavigationStore('flat-a', home, isPlace)
    store.subscribe(() => undefined)
    const before = window.history.length
    store.go(home)
    expect(window.history.length).toBe(before)
  })

  it('replaces the place without adding an entry to the history', () => {
    const store = createNavigationStore('flat-a', home, isPlace)
    store.subscribe(() => undefined)
    store.go({ tab: 'flat', open: false })
    const before = window.history.length
    store.replace({ tab: 'flat', open: true })
    expect(store.getSnapshot()).toEqual({ tab: 'flat', open: true })
    expect(window.history.length).toBe(before)
  })

  it('goes back to the previous place with the back button of the browser', async () => {
    const store = createNavigationStore('flat-a', home, isPlace)
    store.subscribe(() => undefined)
    store.go({ tab: 'flat', open: false })
    store.go({ tab: 'flat', open: true })
    await back()
    expect(store.getSnapshot()).toEqual({ tab: 'flat', open: false })
    await back()
    expect(store.getSnapshot()).toEqual(home)
  })

  it('closes a place that was pushed by going back', async () => {
    const store = createNavigationStore('flat-a', home, isPlace)
    store.subscribe(() => undefined)
    store.go({ tab: 'flat', open: true })
    const popped = new Promise<void>((resolve) =>
      window.addEventListener('popstate', () => resolve(), { once: true }),
    )
    store.close(home)
    await popped
    expect(store.getSnapshot()).toEqual(home)
  })

  it('closes a place that nobody came from by showing the fallback, without leaving', () => {
    window.history.replaceState(
      { housely: { key: 'flat-a', place: { tab: 'flat', open: true } } },
      '',
    )
    const store = createNavigationStore('flat-a', home, isPlace)
    store.subscribe(() => undefined)
    expect(store.getSnapshot()).toEqual({ tab: 'flat', open: true })
    store.close(home)
    expect(store.getSnapshot()).toEqual(home)
  })

  it('leaves several places at once with a single step of the history, and goes back after it', async () => {
    const store = createNavigationStore('flat-a', home, isPlace)
    store.subscribe(() => undefined)
    // A form of three steps: the form and two more places
    store.go({ tab: 'week', open: true })
    store.go({ tab: 'step1', open: true })
    store.go({ tab: 'step2', open: true })
    const popped = new Promise<void>((resolve) =>
      window.addEventListener('popstate', () => resolve(), { once: true }),
    )
    store.closeMany(3, home)
    await popped
    expect(store.getSnapshot()).toEqual(home)
    // Nothing was left behind: one more place can be closed without counting the ones that are gone
    store.go({ tab: 'flat', open: true })
    const again = new Promise<void>((resolve) =>
      window.addEventListener('popstate', () => resolve(), { once: true }),
    )
    store.close(home)
    await again
    expect(store.getSnapshot()).toEqual(home)
  })

  it('shows the fallback when it did not come through that many places, without leaving', () => {
    const store = createNavigationStore('flat-a', home, isPlace)
    store.subscribe(() => undefined)
    store.go({ tab: 'step1', open: true })
    store.closeMany(3, home)
    expect(store.getSnapshot()).toEqual(home)
  })

  it('can change what is restored after a reload, and only then', async () => {
    window.history.replaceState(
      { housely: { key: 'flat-a', place: { tab: 'flat', open: true } } },
      '',
    )
    const store = createNavigationStore('flat-a', home, isPlace, true, (place) => ({
      ...place,
      open: false,
    }))
    store.subscribe(() => undefined)
    expect(store.getSnapshot()).toEqual({ tab: 'flat', open: false })
  })

  it('starts in the initial place, not in the remembered one, when it is told not to restore', () => {
    window.history.replaceState(
      { housely: { key: 'flat-a', place: { tab: 'flat', open: true } } },
      '',
    )
    expect(createNavigationStore('flat-a', home, isPlace, false).getSnapshot()).toEqual(home)
  })

  it('ignores a place that was saved for another flat or that is not valid', () => {
    window.history.replaceState(
      { housely: { key: 'flat-b', place: { tab: 'flat', open: true } } },
      '',
    )
    expect(createNavigationStore('flat-a', home, isPlace).getSnapshot()).toEqual(home)
    window.history.replaceState({ housely: { key: 'flat-a', place: { tab: 3 } } }, '')
    expect(createNavigationStore('flat-a', home, isPlace).getSnapshot()).toEqual(home)
  })
})
