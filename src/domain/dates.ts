// A calendar date (YYYY-MM-DD) as people say it: day and short month in their language (19 Oct, 19 oct).
// It is built from the parts of the date, never from a string, so a timezone can never move it to
// another day.
export const formatDay = (iso: string, locale: string): string => {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

// A calendar date (YYYY-MM-DD) as day and month numbers, zero-padded: 26/10, 01/11.
export const formatDayMonth = (iso: string): string => {
  const [, month, day] = iso.split('-').map(Number)
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`
}

// Adds a whole number of months to a YYYY-MM-DD date. Clamped to the last day of the target month
// (e.g. 31 Jan + 1 month → 28/29 Feb).
export const addMonths = (iso: string, months: number): string => {
  const [year, month, day] = iso.split('-').map(Number)
  const result = new Date(year, month - 1 + months, day)
  // If day overflowed (e.g. Jan 31 + 1 month → Mar 3), clamp to last day of target month
  if (result.getDate() !== day) {
    result.setDate(0) // last day of previous month
  }
  const y = result.getFullYear()
  const m = String(result.getMonth() + 1).padStart(2, '0')
  const d = String(result.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// True when today (YYYY-MM-DD) is within warningDays of the target date.
export const isWithinDays = (today: string, target: string, warningDays: number): boolean => {
  const [ty, tm, td] = today.split('-').map(Number)
  const [gy, gm, gd] = target.split('-').map(Number)
  const todayMs = new Date(ty, tm - 1, td).getTime()
  const targetMs = new Date(gy, gm - 1, gd).getTime()
  const diffDays = (targetMs - todayMs) / (1000 * 60 * 60 * 24)
  return diffDays >= 0 && diffDays <= warningDays
}
