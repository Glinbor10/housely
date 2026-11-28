export type ZoneKind = 'bathroom' | 'kitchen' | 'living' | 'other'

const KEYWORDS: Array<{ kind: Exclude<ZoneKind, 'other'>; words: string[] }> = [
  { kind: 'bathroom', words: ['bath', 'bano', 'aseo', 'wc', 'toilet', 'ducha', 'shower'] },
  { kind: 'kitchen', words: ['kitchen', 'cocina'] },
  { kind: 'living', words: ['living', 'salon', 'sala', 'lounge', 'comedor', 'sofa'] },
]

// The three zones that almost every flat has are told apart by their name (in English or Spanish), so
// they can have their own symbol. Any other name is "other". Accents and case do not matter.
export const zoneKind = (name: string): ZoneKind => {
  const plain = name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  return KEYWORDS.find(({ words }) => words.some((word) => plain.includes(word)))?.kind ?? 'other'
}
