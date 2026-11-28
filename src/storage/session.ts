// What this device knows about the flats of its person: every flat that was created or joined here and
// which one is open. It is not data of the flat, only a way back in, so losing it only means signing in
// again.
export interface Session {
  flatId: string
  memberId: string
}

export interface SavedFlat extends Session {
  // The name the flat had the last time it was seen, to list it without opening it
  name: string
}

export interface FlatBook {
  flats: SavedFlat[]
  activeFlatId: string | null
}

// The subset of Storage the book needs, so tests can use a plain object.
export interface SessionStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

const BOOK_KEY = 'housely:flats'
// The single flat that earlier versions remembered
const LEGACY_KEY = 'housely:session'

const isSavedFlat = (value: unknown): value is SavedFlat =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as SavedFlat).flatId === 'string' &&
  typeof (value as SavedFlat).memberId === 'string' &&
  typeof (value as SavedFlat).name === 'string'

const EMPTY: FlatBook = { flats: [], activeFlatId: null }

// An open flat that is not in the list cannot be open: the first one is.
const normalize = (flats: SavedFlat[], activeFlatId: string | null): FlatBook => ({
  flats,
  activeFlatId: flats.some((flat) => flat.flatId === activeFlatId)
    ? activeFlatId
    : (flats[0]?.flatId ?? null),
})

const parse = (raw: string | null): unknown => {
  try {
    return JSON.parse(raw ?? 'null')
  } catch {
    return null
  }
}

// Storage can be unavailable or corrupted (private mode, manual edits): the app must still start.
export const loadBook = (storage: SessionStorage): FlatBook => {
  try {
    const saved = parse(storage.getItem(BOOK_KEY))
    if (typeof saved === 'object' && saved !== null && Array.isArray((saved as FlatBook).flats)) {
      const { flats, activeFlatId } = saved as FlatBook
      return normalize(
        flats.filter(isSavedFlat),
        typeof activeFlatId === 'string' ? activeFlatId : null,
      )
    }
    // Earlier versions remembered a single flat: it becomes the first one, and is read only once
    const legacy = parse(storage.getItem(LEGACY_KEY))
    if (
      typeof legacy === 'object' &&
      legacy !== null &&
      typeof (legacy as Session).flatId === 'string' &&
      typeof (legacy as Session).memberId === 'string'
    ) {
      const { flatId, memberId } = legacy as Session
      const book = normalize([{ flatId, memberId, name: '' }], flatId)
      saveBook(storage, book)
      storage.removeItem(LEGACY_KEY)
      return book
    }
    return EMPTY
  } catch {
    return EMPTY
  }
}

export const saveBook = (storage: SessionStorage, book: FlatBook): void => {
  try {
    storage.setItem(BOOK_KEY, JSON.stringify(book))
  } catch {
    // The flats are still usable in memory; they just will not be remembered.
  }
}

// Logging out: this device forgets every flat, so the next person to use it starts from scratch.
export const forgetFlats = (storage: SessionStorage): void => {
  try {
    storage.removeItem(BOOK_KEY)
    storage.removeItem(LEGACY_KEY)
  } catch {
    // Nothing was remembered if the storage cannot be used.
  }
}

export const activeFlat = (book: FlatBook): SavedFlat | null =>
  book.flats.find((flat) => flat.flatId === book.activeFlatId) ?? null

// A flat that was already there is updated, not repeated. By default the new one is opened.
export const addFlat = (
  book: FlatBook,
  flat: SavedFlat,
  { open = true }: { open?: boolean } = {},
): FlatBook => {
  const exists = book.flats.some((item) => item.flatId === flat.flatId)
  const flats = exists
    ? book.flats.map((item) => (item.flatId === flat.flatId ? flat : item))
    : [...book.flats, flat]
  return normalize(flats, open ? flat.flatId : book.activeFlatId)
}

export const activateFlat = (book: FlatBook, flatId: string): FlatBook =>
  book.flats.some((flat) => flat.flatId === flatId) ? { ...book, activeFlatId: flatId } : book

// Only that flat goes. If it was the open one, another takes its place; with none left there is no flat.
export const removeFlat = (book: FlatBook, flatId: string): FlatBook =>
  normalize(
    book.flats.filter((flat) => flat.flatId !== flatId),
    book.activeFlatId,
  )

// The person signed in to a Google account that already existed, so the identity of this device changed:
// what the device remembers is now what the account has. The flats that the account does not have cannot
// be opened any more and go; the ones it has are remembered as the account is in them (the member can be
// another one than the member of the old identity, when the account was already in the flat). The open
// flat is replaced if it was left out.
export const adoptAccountFlats = (
  book: FlatBook,
  mine: Array<{ flatId: string; memberId: string; flatName: string }>,
): FlatBook =>
  normalize(
    book.flats.flatMap((flat) => {
      const own = mine.find((item) => item.flatId === flat.flatId)
      return own ? [{ flatId: flat.flatId, memberId: own.memberId, name: own.flatName }] : []
    }),
    book.activeFlatId,
  )

// The same book when nothing changes, so a state that holds it does not render again.
export const renameFlat = (book: FlatBook, flatId: string, name: string): FlatBook =>
  book.flats.some((flat) => flat.flatId === flatId && flat.name !== name)
    ? {
        ...book,
        flats: book.flats.map((flat) => (flat.flatId === flatId ? { ...flat, name } : flat)),
      }
    : book

const memory = new Map<string, string>()

// Used when the browser blocks storage entirely (even reading window.localStorage can throw).
const memoryStorage: SessionStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    memory.set(key, value)
  },
  removeItem: (key) => {
    memory.delete(key)
  },
}

export const getBrowserStorage = (): SessionStorage => {
  try {
    return window.localStorage
  } catch {
    return memoryStorage
  }
}
