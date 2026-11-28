// What happened to the homes of the device when the person signed in to an account that already
// existed: the ones that came along and the ones that stayed behind. It lives outside the screens on
// purpose: the identity changes, the screens start again, and the notice must survive that.
export interface AccountNotice {
  broughtAlong: string[]
  leftBehind: string[]
  // Counts the switches of account. The readings of a home that was open during the switch failed (the
  // new identity was not in it yet) and keep that error, so the home starts again when this changes.
  switches: number
}

const NONE: AccountNotice = { broughtAlong: [], leftBehind: [], switches: 0 }

export const createAccountNoticeStore = () => {
  let notice: AccountNotice = NONE
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => notice,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    set: (next: Pick<AccountNotice, 'broughtAlong' | 'leftBehind'>) => {
      notice = { ...next, switches: notice.switches + 1 }
      listeners.forEach((listener) => listener())
    },
    // Each notice goes away on its own when the person closes it
    dismiss: (which: 'broughtAlong' | 'leftBehind') => {
      notice = { ...notice, [which]: [] }
      listeners.forEach((listener) => listener())
    },
  }
}

export const accountNotice = createAccountNoticeStore()
