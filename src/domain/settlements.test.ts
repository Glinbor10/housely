import { describe, expect, it } from 'vitest'
import { MAX_NOTE, settlementId, validateSettlement, type Settlement } from './settlements'

const late: Settlement = {
  weekIndex: 1,
  zone: 'Kitchen',
  kind: 'late',
  memberId: 'm1',
  doneAt: '2026-10-22',
}

describe('settlementId', () => {
  it('is the week and the zone, like a completion, so a zone is settled only once', () => {
    expect(settlementId(3, 'Living room')).toBe('3_Living room')
  })
})

describe('validateSettlement', () => {
  it('accepts a zone done late with its date', () => {
    expect(validateSettlement(late, 'm0')).toEqual([])
  })

  it('needs a valid date for a zone done late', () => {
    expect(validateSettlement({ ...late, doneAt: undefined }, 'm0')).toContain('date-required')
    expect(validateSettlement({ ...late, doneAt: '22/10/2026' }, 'm0')).toContain('date-invalid')
    expect(validateSettlement({ ...late, doneAt: '2026-02-30' }, 'm0')).toContain('date-invalid')
  })

  it('needs somebody to cover a zone covered by another person, and not the person who had it', () => {
    const covered: Settlement = { weekIndex: 1, zone: 'Kitchen', kind: 'covered', memberId: 'm1' }
    expect(validateSettlement(covered, 'm0')).toContain('cover-required')
    expect(validateSettlement({ ...covered, coveredBy: 'm0' }, 'm0')).toContain('cover-is-assigned')
    expect(validateSettlement({ ...covered, coveredBy: 'm2' }, 'm0')).toEqual([])
  })

  it('accepts the date of the cleaning when it was covered, but does not require it', () => {
    const covered: Settlement = {
      weekIndex: 1,
      zone: 'Kitchen',
      kind: 'covered',
      memberId: 'm1',
      coveredBy: 'm2',
    }
    expect(validateSettlement({ ...covered, doneAt: '2026-10-22' }, 'm0')).toEqual([])
    expect(validateSettlement({ ...covered, doneAt: 'yesterday' }, 'm0')).toContain('date-invalid')
  })

  it('forgives with nothing else: no date and no cover are needed', () => {
    const away: Settlement = { weekIndex: 1, zone: 'Kitchen', kind: 'away', memberId: 'm1' }
    expect(validateSettlement(away, 'm0')).toEqual([])
  })

  describe('made up with another cleaning', () => {
    const madeUp: Settlement = {
      weekIndex: 1,
      zone: 'Kitchen',
      kind: 'madeUp',
      memberId: 'm1',
      tookWeek: 3,
      tookZone: 'Bathroom',
    }

    it('needs the cleaning that was taken to settle it', () => {
      expect(validateSettlement(madeUp, 'm0')).toEqual([])
      expect(validateSettlement({ ...madeUp, tookWeek: undefined }, 'm0')).toContain(
        'took-required',
      )
      expect(validateSettlement({ ...madeUp, tookZone: undefined }, 'm0')).toContain(
        'took-required',
      )
    })

    it('takes a cleaning of a later week than the one it settles', () => {
      expect(validateSettlement({ ...madeUp, tookWeek: 1 }, 'm0')).toContain('took-not-later')
      expect(validateSettlement({ ...madeUp, tookWeek: 0 }, 'm0')).toContain('took-not-later')
    })

    it('does not accept a taken cleaning in the other types', () => {
      expect(validateSettlement({ ...late, tookWeek: 3, tookZone: 'Bathroom' }, 'm0')).toContain(
        'took-unexpected',
      )
    })
  })

  it('limits the note, which everybody can read', () => {
    expect(validateSettlement({ ...late, note: 'x'.repeat(MAX_NOTE) }, 'm0')).toEqual([])
    expect(validateSettlement({ ...late, note: 'x'.repeat(MAX_NOTE + 1) }, 'm0')).toContain(
      'note-too-long',
    )
  })
})
