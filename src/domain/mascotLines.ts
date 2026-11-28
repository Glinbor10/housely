import type { MessageKey } from '../i18n/i18n'

// What the mascot has to tell. The two anger cases are told apart: one is about the cleanings left
// undone in finished weeks (told by number) and the other about the last day of the week.
export type MascotCase = 'party' | 'worried' | 'angryDebts' | 'angryDebtsOne' | 'angryWeek' | 'rest'

// Five lines per case, the original one first. Housy rotates through them day by day: the seed is
// the day of the flat, so the same line stays all day and changes at midnight. To add one, add the
// key in en.ts and es.ts (mascot.say.<case>.<n>) and list it here.
// The lines of angryDebts tell the number of cleanings with {n}; the ones of angryDebtsOne do not.
export const MASCOT_LINES: Record<MascotCase, readonly MessageKey[]> = {
  party: [
    'mascot.say.party',
    'mascot.say.party.2',
    'mascot.say.party.3',
    'mascot.say.party.4',
    'mascot.say.party.5',
  ],
  worried: [
    'mascot.say.worried',
    'mascot.say.worried.2',
    'mascot.say.worried.3',
    'mascot.say.worried.4',
    'mascot.say.worried.5',
  ],
  angryDebts: [
    'mascot.say.angryDebts',
    'mascot.say.angryDebts.2',
    'mascot.say.angryDebts.3',
    'mascot.say.angryDebts.4',
    'mascot.say.angryDebts.5',
  ],
  angryDebtsOne: [
    'mascot.say.angryDebtsOne',
    'mascot.say.angryDebtsOne.2',
    'mascot.say.angryDebtsOne.3',
    'mascot.say.angryDebtsOne.4',
    'mascot.say.angryDebtsOne.5',
  ],
  angryWeek: [
    'mascot.say.angryWeek',
    'mascot.say.angryWeek.2',
    'mascot.say.angryWeek.3',
    'mascot.say.angryWeek.4',
    'mascot.say.angryWeek.5',
  ],
  rest: [
    'mascot.say.rest',
    'mascot.say.rest.2',
    'mascot.say.rest.3',
    'mascot.say.rest.4',
    'mascot.say.rest.5',
  ],
}

interface MascotLineInput {
  // What the mood of the mascot asks it to tell, when it asks for something
  speechCase: 'party' | 'worried' | 'angryDebts' | 'angryWeek' | undefined
  // The person has no zone this week
  resting: boolean
  // The cleanings the person left undone in finished weeks
  debts: number
  // Changes with the day, so the line does too
  seed: number
}

// The debts come first (they are what the mascot is angry about), then the rest of the person, and
// then the line of the mood. With nothing to tell, the bubble is not shown.
export const pickMascotLine = ({
  speechCase,
  resting,
  debts,
  seed,
}: MascotLineInput): MessageKey | undefined => {
  const kind: MascotCase | undefined =
    speechCase === 'angryDebts'
      ? debts === 1
        ? 'angryDebtsOne'
        : 'angryDebts'
      : resting
        ? 'rest'
        : speechCase
  if (!kind) return undefined
  const lines = MASCOT_LINES[kind]
  return lines[seed % lines.length]
}
