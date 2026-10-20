// How the mascot feels about the week: it is the main "hook" of the app.
export type Mood = 'sleepy' | 'happy' | 'party'

export const getWeekMood = (done: number, total: number): Mood =>
  total === 0 || done === 0 ? 'sleepy' : done >= total ? 'party' : 'happy'
