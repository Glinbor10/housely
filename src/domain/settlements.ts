// How a zone that nobody cleaned in its week is settled. The group decides, and the way it was
// settled stays visible so nothing is hidden.
export type SettlementKind = 'late' | 'covered' | 'away' | 'madeUp'

export interface Settlement {
  weekIndex: number
  zone: string
  kind: SettlementKind
  // Who recorded it
  memberId: string
  // Who cleaned it instead, when it was covered
  coveredBy?: string
  // The cleaning of a later week that was taken to settle it, when it was made up
  tookWeek?: number
  tookZone?: string
  // Local calendar date of the cleaning, YYYY-MM-DD (required when it was done late)
  doneAt?: string
  // Shown to everybody
  note?: string
}

export const MAX_NOTE = 140

// One per zone and week, with the same identifier as a completion
export const settlementId = (weekIndex: number, zone: string): string => `${weekIndex}_${zone}`

const isValidIsoDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [year, month, day] = match.slice(1).map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

// Error codes, never user-facing text, so the screen can translate them.
export const validateSettlement = (settlement: Settlement, assignedTo: string): string[] => {
  const errors: string[] = []
  if (settlement.kind === 'late') {
    if (!settlement.doneAt) errors.push('date-required')
  }
  if (settlement.doneAt && !isValidIsoDate(settlement.doneAt)) errors.push('date-invalid')
  if (settlement.kind === 'covered') {
    if (!settlement.coveredBy) errors.push('cover-required')
    else if (settlement.coveredBy === assignedTo) errors.push('cover-is-assigned')
  }
  if (settlement.kind === 'madeUp') {
    if (settlement.tookWeek === undefined || !settlement.tookZone) errors.push('took-required')
    else if (settlement.tookWeek <= settlement.weekIndex) errors.push('took-not-later')
  } else if (settlement.tookWeek !== undefined || settlement.tookZone !== undefined) {
    errors.push('took-unexpected')
  }
  if ((settlement.note ?? '').length > MAX_NOTE) errors.push('note-too-long')
  return errors
}
