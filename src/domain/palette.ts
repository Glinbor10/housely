// The colors a person can have in a flat. A fixed palette keeps the calendar and the avatars legible
// (every color has readable text on it) and lets the Firestore rules check the value. The first eight
// are the ones flats were created with: they never change order.
export type ColorId =
  | 'blue'
  | 'green'
  | 'orange'
  | 'purple'
  | 'red'
  | 'teal'
  | 'brown'
  | 'slate'
  | 'pink'
  | 'lime'
  | 'indigo'
  | 'amber'

export interface PersonColor {
  // Name used for the translation of its label (color.<id>)
  id: ColorId
  hex: string
}

export const PERSON_COLORS: readonly PersonColor[] = [
  { id: 'blue', hex: '#1976d2' },
  { id: 'green', hex: '#388e3c' },
  { id: 'orange', hex: '#f57c00' },
  { id: 'purple', hex: '#7b1fa2' },
  { id: 'red', hex: '#d32f2f' },
  { id: 'teal', hex: '#0097a7' },
  { id: 'brown', hex: '#5d4037' },
  { id: 'slate', hex: '#455a64' },
  { id: 'pink', hex: '#c2185b' },
  { id: 'lime', hex: '#9e9d24' },
  { id: 'indigo', hex: '#303f9f' },
  { id: 'amber', hex: '#ffa000' },
]

export const colorForPerson = (index: number): string =>
  PERSON_COLORS[index % PERSON_COLORS.length].hex

// The colors of the people of a new flat, in order. The owner may choose theirs: it is theirs alone, and
// the others take the palette in order without it, so nobody repeats unless there are more people than colors.
export const colorsForPeople = (
  count: number,
  ownerIndex: number,
  ownerColor?: string,
): string[] => {
  if (ownerColor === undefined)
    return Array.from({ length: count }, (_, index) => colorForPerson(index))
  const others = PERSON_COLORS.filter((color) => color.hex !== ownerColor)
  let next = 0
  return Array.from({ length: count }, (_, index) =>
    index === ownerIndex ? ownerColor : others[next++ % others.length].hex,
  )
}

export const isPaletteColor = (hex: string): boolean =>
  PERSON_COLORS.some((color) => color.hex === hex)

// A neutral grey for someone whose color is not known (for example a person who left the flat)
export const UNKNOWN_PERSON_COLOR = '#9e9e9e'
