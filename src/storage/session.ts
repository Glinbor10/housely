export interface Session {
  flatId: string
  memberId: string
}

// The subset of Storage the session needs, so tests can use a plain object.
export interface SessionStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

const STORAGE_KEY = 'housely:session'

const isSession = (value: unknown): value is Session =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Session).flatId === 'string' &&
  typeof (value as Session).memberId === 'string'

// Storage can be unavailable or corrupted (private mode, manual edits): the app must still start.
export const loadSession = (storage: SessionStorage): Session | null => {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null')
    return isSession(parsed) ? { flatId: parsed.flatId, memberId: parsed.memberId } : null
  } catch {
    return null
  }
}

export const saveSession = (storage: SessionStorage, session: Session): void => {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // The flat is still usable in memory; it just will not be remembered.
  }
}

export const clearSession = (storage: SessionStorage): void => {
  try {
    storage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clean if storage is unavailable.
  }
}
