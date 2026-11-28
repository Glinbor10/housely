import { describe, expect, it } from 'vitest'
import {
  activateFlat,
  activeFlat,
  addFlat,
  forgetFlats,
  loadBook,
  removeFlat,
  adoptAccountFlats,
  renameFlat,
  saveBook,
  type FlatBook,
} from './session'

const createStorage = (initial: Record<string, string> = {}) => {
  const data = { ...initial }
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value
    },
    removeItem: (key: string) => {
      delete data[key]
    },
  }
}

const flat = (id: string, name = `Flat ${id}`) => ({ flatId: id, memberId: `m-${id}`, name })
const empty: FlatBook = { flats: [], activeFlatId: null }

describe('the flats of this device', () => {
  it('starts without flats', () => {
    expect(loadBook(createStorage())).toEqual(empty)
    expect(activeFlat(empty)).toBeNull()
  })

  it('saves and loads every flat and which one is open', () => {
    const storage = createStorage()
    const book = addFlat(addFlat(empty, flat('a')), flat('b'))
    saveBook(storage, book)
    expect(loadBook(storage)).toEqual(book)
  })

  describe('forgetFlats', () => {
    it('removes every flat from the device, also the one of earlier versions', () => {
      const storage = createStorage({
        'housely:session': JSON.stringify({ flatId: 'old', memberId: 'm-old' }),
      })
      saveBook(storage, addFlat(addFlat(empty, flat('a')), flat('b')))
      forgetFlats(storage)
      expect(storage.data).toEqual({})
      expect(loadBook(storage)).toEqual(empty)
    })
  })

  describe('addFlat', () => {
    it('keeps the flats that were already there and opens the new one', () => {
      const book = addFlat(addFlat(empty, flat('a')), flat('b'))
      expect(book.flats.map((item) => item.flatId)).toEqual(['a', 'b'])
      expect(book.activeFlatId).toBe('b')
      expect(activeFlat(book)?.memberId).toBe('m-b')
    })

    it('does not repeat a flat that is added again: it is updated and opened', () => {
      const first = addFlat(addFlat(empty, flat('a')), flat('b'))
      const again = addFlat(first, { flatId: 'a', memberId: 'm-new', name: 'Renamed' })
      expect(again.flats).toHaveLength(2)
      expect(again.flats.find((item) => item.flatId === 'a')).toEqual({
        flatId: 'a',
        memberId: 'm-new',
        name: 'Renamed',
      })
      expect(again.activeFlatId).toBe('a')
    })

    it('can add flats without opening them, for the ones found with Google', () => {
      const book = addFlat(addFlat(empty, flat('a')), flat('b'), { open: false })
      expect(book.flats).toHaveLength(2)
      expect(book.activeFlatId).toBe('a')
    })
  })

  describe('activateFlat', () => {
    it('opens a flat of the device and ignores one that is not there', () => {
      const book = addFlat(addFlat(empty, flat('a')), flat('b'))
      expect(activateFlat(book, 'a').activeFlatId).toBe('a')
      expect(activateFlat(book, 'nope')).toEqual(book)
    })
  })

  describe('removeFlat', () => {
    const two = addFlat(addFlat(empty, flat('a')), flat('b'))

    it('removes only that flat and keeps the others', () => {
      const book = removeFlat(two, 'a')
      expect(book.flats.map((item) => item.flatId)).toEqual(['b'])
      expect(book.activeFlatId).toBe('b')
    })

    it('opens another flat when the open one is removed', () => {
      const book = removeFlat(two, 'b')
      expect(book.flats.map((item) => item.flatId)).toEqual(['a'])
      expect(book.activeFlatId).toBe('a')
    })

    it('ends with no flat when the last one is removed', () => {
      expect(removeFlat(removeFlat(two, 'a'), 'b')).toEqual(empty)
    })
  })

  describe('adoptAccountFlats', () => {
    const own = (id: string, memberId = `account-${id}`) => ({
      flatId: id,
      memberId,
      flatName: `Account ${id}`,
    })

    it('drops the flats that the account does not have, and moves the open one if it went', () => {
      const book = addFlat(addFlat(empty, flat('joined')), flat('mine'), { open: false })
      expect(book.activeFlatId).toBe('joined')
      const adopted = adoptAccountFlats(book, [own('mine'), own('other')])
      expect(adopted.flats.map((item) => item.flatId)).toEqual(['mine'])
      expect(adopted.activeFlatId).toBe('mine')
    })

    it('remembers the member that the account has in a flat it already was in, not the old one', () => {
      const book = addFlat(empty, flat('shared'))
      expect(book.flats[0].memberId).toBe('m-shared')
      const adopted = adoptAccountFlats(book, [own('shared', 'owner-member')])
      expect(adopted.flats).toEqual([
        { flatId: 'shared', memberId: 'owner-member', name: 'Account shared' },
      ])
    })

    it('leaves no open flat when the account has none of them', () => {
      expect(adoptAccountFlats(addFlat(empty, flat('joined')), [])).toEqual(empty)
    })
  })

  describe('renameFlat', () => {
    it('keeps the name that the flat has now, and returns the same book when nothing changes', () => {
      const book = addFlat(empty, flat('a', 'Old'))
      expect(renameFlat(book, 'a', 'New').flats[0].name).toBe('New')
      expect(renameFlat(book, 'a', 'Old')).toBe(book)
      expect(renameFlat(book, 'nope', 'New')).toBe(book)
    })
  })

  describe('the session of earlier versions', () => {
    it('is read as the first flat of the device, and is not read again', () => {
      const storage = createStorage({
        'housely:session': JSON.stringify({ flatId: 'old', memberId: 'm-old' }),
      })
      const book = loadBook(storage)
      expect(book.flats).toEqual([{ flatId: 'old', memberId: 'm-old', name: '' }])
      expect(book.activeFlatId).toBe('old')
      expect(storage.data['housely:session']).toBeUndefined()
      expect(loadBook(storage)).toEqual(book)
    })
  })

  describe('corrupted or blocked storage', () => {
    it.each(['not json', '{}', 'null', '[]', '{"flats":"x"}', '{"flats":[{"flatId":1}]}'])(
      'starts clean with %s',
      (raw) => {
        expect(loadBook(createStorage({ 'housely:flats': raw }))).toEqual(empty)
      },
    )

    it('ignores the entries that are broken and keeps the good ones', () => {
      const raw = JSON.stringify({
        flats: [flat('a'), { flatId: 2 }, flat('c')],
        activeFlatId: 'c',
      })
      const book = loadBook(createStorage({ 'housely:flats': raw }))
      expect(book.flats.map((item) => item.flatId)).toEqual(['a', 'c'])
      expect(book.activeFlatId).toBe('c')
    })

    it('opens the first flat when the open one is not in the list', () => {
      const raw = JSON.stringify({ flats: [flat('a')], activeFlatId: 'gone' })
      expect(loadBook(createStorage({ 'housely:flats': raw })).activeFlatId).toBe('a')
    })

    it('survives a storage that throws', () => {
      const broken = {
        getItem: () => {
          throw new Error('blocked')
        },
        setItem: () => {
          throw new Error('blocked')
        },
        removeItem: () => {
          throw new Error('blocked')
        },
      }
      expect(loadBook(broken)).toEqual(empty)
      expect(() => saveBook(broken, addFlat(empty, flat('a')))).not.toThrow()
    })
  })
})
