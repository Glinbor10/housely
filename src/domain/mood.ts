// How the mascot feels. Each mood is tied to something the app really knows, so it is a signal and
// not decoration: the week, the day of the week and the zones left undone in finished weeks.
export type Mood = 'sleepy' | 'happy' | 'party' | 'worried' | 'sad' | 'angry'

export const getWeekMood = (done: number, total: number): Mood =>
  total === 0 || done === 0 ? 'sleepy' : done >= total ? 'party' : 'happy'

export interface MoodInput {
  done: number
  total: number
  // 0 = first day of the flat's week ... 6 = last day
  dayInWeek: number
  // Zones of the person looking at the screen that were left undone in finished weeks
  mine: number
  // Zones of anybody else that were left undone in finished weeks
  others: number
  // Zones of the week in progress that are still pending and belong to the person looking at the screen
  mineThisWeek: number
}

// The last three days of the week are the ones that worry, and the last one makes the mascot angry
const WORRIED_FROM_DAY = 4
const LAST_DAY = 6

// A clean week is always celebrated. Otherwise the most personal feeling wins: angry (your own
// undone zones, from this week or from finished ones), then sad (the flat's), then worried (the
// week is running out), then the progress.
export const getMascotMood = ({
  done,
  total,
  dayInWeek,
  mine,
  others,
  mineThisWeek,
}: MoodInput): Mood => {
  if (total > 0 && done >= total) return 'party'
  if (mine > 0) return 'angry'
  if (dayInWeek === LAST_DAY && mineThisWeek > 0) return 'angry'
  if (others > 0) return 'sad'
  if (total > 0 && dayInWeek >= WORRIED_FROM_DAY) return 'worried'
  return getWeekMood(done, total)
}
