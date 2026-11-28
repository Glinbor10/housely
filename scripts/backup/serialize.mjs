// Turns the values of Firestore into plain JSON and back, without losing their type: a timestamp, a
// reference or a block of bytes written as text would come back as a string and break the app.
import { DocumentReference, GeoPoint, Timestamp } from '@google-cloud/firestore'

const TYPE = '__type'

const isPlainObject = (value) => Object.getPrototypeOf(value) === Object.prototype

export const encodeValue = (value) => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    // JSON has no way to write these three
    return Number.isFinite(value) ? value : { [TYPE]: 'number', value: String(value) }
  }
  if (value instanceof Timestamp) {
    return { [TYPE]: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds }
  }
  if (value instanceof GeoPoint) {
    return { [TYPE]: 'geopoint', latitude: value.latitude, longitude: value.longitude }
  }
  if (value instanceof DocumentReference) return { [TYPE]: 'reference', path: value.path }
  if (value instanceof Uint8Array) {
    return { [TYPE]: 'bytes', base64: Buffer.from(value).toString('base64') }
  }
  if (Array.isArray(value)) return value.map(encodeValue)
  if (typeof value === 'object' && isPlainObject(value)) {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, encodeValue(item)])
    const map = Object.fromEntries(entries)
    // A map of the user that has the tag key is wrapped, so it is never taken for a tag when it is read
    return TYPE in map ? { [TYPE]: 'map', value: map } : map
  }
  throw new TypeError(`Cannot back up a value of type ${typeof value}`)
}

export const decodeValue = (value, db) => {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => decodeValue(item, db))
  switch (value[TYPE]) {
    case undefined:
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, decodeValue(item, db)]),
      )
    case 'number':
      return Number(value.value)
    case 'timestamp':
      return new Timestamp(value.seconds, value.nanoseconds)
    case 'geopoint':
      return new GeoPoint(value.latitude, value.longitude)
    case 'reference':
      return db.doc(value.path)
    case 'bytes':
      return Buffer.from(value.base64, 'base64')
    case 'map':
      return Object.fromEntries(
        Object.entries(value.value).map(([key, item]) => [key, decodeValue(item, db)]),
      )
    default:
      throw new TypeError(`Unknown type in the backup: ${value[TYPE]}`)
  }
}
