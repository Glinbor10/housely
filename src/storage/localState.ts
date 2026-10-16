import type { Completion } from '../domain/completions'

export interface Household {
  name: string
  members: string[]
  zones: string[]
  // ISO date (YYYY-MM-DD) from which the rotation starts
  startDate: string
}

export interface AppState {
  household: Household
  completions: Completion[]
  currentMember: string
}

const STORAGE_KEY = 'housely:state'

// Temporary default until the "create flat" flow and Firebase sync exist.
export const createDefaultState = (): AppState => ({
  household: {
    name: 'My flat',
    members: ['Ana', 'Ben', 'Carl'],
    zones: ['Living room', 'Kitchen', 'Bathroom'],
    startDate: '2026-10-12',
  },
  completions: [],
  currentMember: 'Ana',
})

export const loadState = (): AppState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AppState) : createDefaultState()
  } catch {
    return createDefaultState()
  }
}

export const saveState = (state: AppState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage can be unavailable (private mode); the app keeps working in memory.
  }
}
