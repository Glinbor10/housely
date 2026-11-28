// Amounts are whole cents, never fractions of a euro: 12,50 € is 1250. That keeps every sum exact.
export const MAX_CENTS = 10_000_000

// What a person types, as cents, or null when it is not a usable amount. A comma or a dot can be the
// decimal separator, and the other one groups thousands (1.234,56 and 1,234.56 are the same amount).
// A single separator followed by exactly three digits is read as thousands (1.234 is 1234).
export const parseEuros = (text: string): number | null => {
  const compact = text.replace(/[\s€]/g, '')
  if (!/^[\d.,]+$/.test(compact)) return null

  const lastDot = compact.lastIndexOf('.')
  const lastComma = compact.lastIndexOf(',')
  const separatorAt = Math.max(lastDot, lastComma)

  let integer = compact
  let fraction = ''
  if (separatorAt !== -1) {
    const separator = compact[separatorAt]
    const bothKinds = lastDot !== -1 && lastComma !== -1
    const count = compact.split(separator).length - 1
    const after = compact.slice(separatorAt + 1)
    const before = compact.slice(0, separatorAt)
    if (bothKinds) {
      // The last separator is the decimal one, the other kind groups thousands
      integer = before.replace(/[.,]/g, '')
      fraction = after
    } else if (count > 1) {
      // Only thousands: every group after the first has three digits
      const groups = compact.split(separator)
      if (groups.slice(1).some((group) => group.length !== 3)) return null
      integer = groups.join('')
    } else if (after.length === 3) {
      integer = before + after
    } else {
      integer = before
      fraction = after
    }
  }

  if (integer === '') integer = '0'
  if (!/^\d+$/.test(integer) || !/^\d{0,2}$/.test(fraction)) return null
  if (separatorAt !== -1 && integer === compact && fraction === '') return null

  const cents = Number(integer) * 100 + Number(fraction.padEnd(2, '0'))
  return cents > 0 && cents <= MAX_CENTS ? cents : null
}

// The amount as euros in the language of the person: €12.50 or 12,50 €
export const formatEuros = (cents: number, locale: string): string =>
  new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
