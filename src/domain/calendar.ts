import { toIsoDate } from './completions'

export interface CalendarCompletion {
  // Local calendar date, YYYY-MM-DD
  doneAt: string
  memberId: string
  zone: string
}

export interface CalendarEntry {
  memberId: string
  zone: string
}

export interface CalendarDay {
  date: string
  // False for the days of the neighbour months that only fill the first and last rows
  inMonth: boolean
  isToday: boolean
  entries: CalendarEntry[]
}

export interface YearMonth {
  year: number
  // 0 = January ... 11 = December
  month: number
}

export interface CalendarMonth extends YearMonth {
  weeks: CalendarDay[][]
}

interface MonthInput extends YearMonth {
  completions: CalendarCompletion[]
  // Local calendar date of today, YYYY-MM-DD
  today: string
}

// The month in weeks that start on Monday, with exactly the rows it needs. Date arithmetic is done
// on local calendar dates, so changes of daylight saving time cannot move a day.
export const buildMonth = ({ year, month, completions, today }: MonthInput): CalendarMonth => {
  const leading = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const rows = Math.ceil((leading + daysInMonth) / 7)

  const byDate = new Map<string, CalendarEntry[]>()
  for (const { doneAt, memberId, zone } of completions) {
    byDate.set(doneAt, [...(byDate.get(doneAt) ?? []), { memberId, zone }])
  }

  const weeks: CalendarDay[][] = []
  for (let row = 0; row < rows; row += 1) {
    weeks.push(
      Array.from({ length: 7 }, (_, column) => {
        const day = new Date(year, month, 1 - leading + row * 7 + column)
        const date = toIsoDate(day)
        return {
          date,
          inMonth: day.getMonth() === month,
          isToday: date === today,
          entries: byDate.get(date) ?? [],
        }
      }),
    )
  }
  return { year, month, weeks }
}

export const shiftMonth = ({ year, month }: YearMonth, delta: number): YearMonth => {
  const index = year * 12 + month + delta
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 }
}
