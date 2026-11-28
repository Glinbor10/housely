import { Firestore, GeoPoint, Timestamp } from '@google-cloud/firestore'
import { describe, expect, it } from 'vitest'
import { decodeValue, encodeValue } from './serialize.mjs'

// A client that never connects: it is only used to build references
const db = new Firestore({ projectId: 'demo-housely' })

const roundTrip = (value) => decodeValue(JSON.parse(JSON.stringify(encodeValue(value))), db)

describe('encodeValue and decodeValue', () => {
  it('keeps text, booleans, null and numbers as they are', () => {
    for (const value of ['Kitchen', '', true, false, null, 0, 42, -7, 1.5]) {
      expect(encodeValue(value)).toBe(value)
      expect(roundTrip(value)).toBe(value)
    }
  })

  it('keeps the numbers that JSON cannot write', () => {
    expect(roundTrip(Number.NaN)).toBeNaN()
    expect(roundTrip(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY)
    expect(roundTrip(Number.NEGATIVE_INFINITY)).toBe(Number.NEGATIVE_INFINITY)
  })

  it('keeps a timestamp down to the nanosecond', () => {
    const original = new Timestamp(1_760_000_000, 123_456_789)
    const restored = roundTrip(original)
    expect(restored).toBeInstanceOf(Timestamp)
    expect(restored.seconds).toBe(1_760_000_000)
    expect(restored.nanoseconds).toBe(123_456_789)
  })

  it('keeps a place, a reference and binary data', () => {
    const place = roundTrip(new GeoPoint(40.4, -3.7))
    expect(place).toBeInstanceOf(GeoPoint)
    expect([place.latitude, place.longitude]).toEqual([40.4, -3.7])

    const reference = roundTrip(db.doc('flats/f1/members/m0'))
    expect(reference.path).toBe('flats/f1/members/m0')

    const bytes = roundTrip(Buffer.from([0, 1, 2, 255]))
    expect([...bytes]).toEqual([0, 1, 2, 255])
  })

  it('keeps lists and maps nested as deep as they come', () => {
    const original = {
      name: 'My flat',
      zones: ['Kitchen', 'Bathroom'],
      periodClose: { nextCloseDate: '2027-05-13', intervalMonths: 6 },
      createdAt: new Timestamp(1_760_000_000, 0),
      nested: [{ list: [1, { deep: true }] }],
    }
    const restored = roundTrip(original)
    expect(restored).toEqual(original)
    expect(restored.createdAt).toBeInstanceOf(Timestamp)
  })

  it('does not write what is undefined, as Firestore does not store it', () => {
    expect(encodeValue({ kept: 1, dropped: undefined })).toEqual({ kept: 1 })
  })

  it('does not mistake data that looks like a tag for a tag', () => {
    // A map of the user that has a "__type" key must come back as that same map
    const original = { __type: 'timestamp', seconds: 1, nanoseconds: 2 }
    expect(roundTrip(original)).toEqual(original)
  })

  it('refuses what it does not know how to save, instead of losing it silently', () => {
    expect(() => encodeValue(() => 1)).toThrow(/cannot back up/i)
    expect(() => encodeValue(10n)).toThrow(/cannot back up/i)
  })
})
