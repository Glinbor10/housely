const STATE_KEY = 'housely'

export interface NavigationStore<T> {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => T
  // Moves to a new place: the back button of the browser (or of Android) comes back to the one it leaves
  go: (next: T) => void
  // Changes the place without adding an entry to the history (a form replaced by another one)
  replace: (next: T) => void
  // Goes back to where the person came from. If they did not come from inside the app (the page was
  // reloaded on this place) it shows the fallback instead of leaving the app.
  close: (fallback: T) => void
  // The same, going back several places at once (a form of several steps). If the person did not come
  // through that many places inside the app, it shows the fallback.
  closeMany: (count: number, fallback: T) => void
}

// Where the person is inside a screen (a section, a sub-view), kept in the history of the browser so the
// back button does what people expect, without a router. It is an external store, so it needs no effect.
// Every place is stored with the key of what it belongs to (a flat): a place of another flat is ignored.
// It starts from the place the history remembers (after a reload) only when `restore` is true.
export const createNavigationStore = <T extends object>(
  key: string,
  initial: T,
  isPlace: (value: unknown) => value is T,
  restore = true,
  // What the place becomes when it is restored after a reload (a form or a dialog that was open should not
  // come back). It does not apply when going back or forward in the history.
  onRestore: (place: T) => T = (place) => place,
): NavigationStore<T> => {
  const read = (state: unknown): T => {
    const entry = (state as Record<string, { key?: string; place?: unknown }> | null)?.[STATE_KEY]
    return entry?.key === key && isPlace(entry.place) ? entry.place : initial
  }
  const write = (place: T) => ({ ...window.history.state, [STATE_KEY]: { key, place } })

  let current = restore ? onRestore(read(window.history.state)) : initial
  // How many places this screen pushed that can still be gone back to
  let pushed = 0
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((listener) => listener())
  const onPop = (event: PopStateEvent) => {
    current = read(event.state)
    pushed = Math.max(0, pushed - 1)
    emit()
  }

  return {
    subscribe: (listener) => {
      if (listeners.size === 0) {
        window.addEventListener('popstate', onPop)
        // The entry the person is on knows its place, so coming back to it restores it
        window.history.replaceState(write(current), '')
      }
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) window.removeEventListener('popstate', onPop)
      }
    },
    getSnapshot: () => current,
    go: (next) => {
      if (JSON.stringify(next) === JSON.stringify(current)) return
      current = next
      pushed += 1
      window.history.pushState(write(next), '')
      emit()
    },
    replace: (next) => {
      current = next
      window.history.replaceState(write(next), '')
      emit()
    },
    close: (fallback) => {
      if (pushed > 0) {
        window.history.back()
        return
      }
      current = fallback
      window.history.replaceState(write(fallback), '')
      emit()
    },
    closeMany: (count, fallback) => {
      if (count > 0 && pushed >= count) {
        // One popstate arrives for all of them, and it takes one away by itself
        pushed -= count - 1
        window.history.go(-count)
        return
      }
      current = fallback
      window.history.replaceState(write(fallback), '')
      emit()
    },
  }
}
