export interface Completion {
  weekIndex: number
  zone: string
  member: string
  // Local calendar date, YYYY-MM-DD
  doneAt: string
}

export const toIsoDate = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export const findCompletion = (
  completions: Completion[],
  weekIndex: number,
  zone: string,
): Completion | undefined =>
  completions.find((completion) => completion.weekIndex === weekIndex && completion.zone === zone)

// One completion per zone and week: marking again replaces the previous entry (date correction).
export const markDone = (completions: Completion[], entry: Completion): Completion[] => [
  ...completions.filter(
    (completion) => !(completion.weekIndex === entry.weekIndex && completion.zone === entry.zone),
  ),
  entry,
]
