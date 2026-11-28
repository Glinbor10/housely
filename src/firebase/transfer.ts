import type { Firestore } from 'firebase/firestore'
import type { SavedFlat } from '../storage/session'
import { claimTransferTicket, deleteTransferTicket, leaveTransferTicket } from './flatRepository'

// A home that the identity of this device is about to leave behind, with the secret that proves it
export interface PendingTransfer {
  flatId: string
  memberId: string
  name: string
  fromUid: string
  secret: string
}

// 16 random bytes as 32 hex characters: the rules ask for exactly that size
export const makeSecret = (
  randomBytes: () => number[] = () => Array.from(crypto.getRandomValues(new Uint8Array(16))),
): string =>
  randomBytes()
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')

// Before the device switches to a Google account that already exists: one ticket per home. A home that
// cannot leave one (the person is not a member any more) is skipped, and the rest go on.
export const leaveTickets = async (
  db: Firestore,
  uid: string,
  flats: SavedFlat[],
  secret: () => string = makeSecret,
): Promise<PendingTransfer[]> => {
  const results = await Promise.all(
    flats.map(async (flat): Promise<PendingTransfer | null> => {
      const pending = {
        flatId: flat.flatId,
        memberId: flat.memberId,
        name: flat.name,
        fromUid: uid,
        secret: secret(),
      }
      try {
        await leaveTransferTicket(db, { ...pending, uid })
        return pending
      } catch {
        return null
      }
    }),
  )
  return results.filter((pending): pending is PendingTransfer => pending !== null)
}

export interface TransferResult {
  moved: PendingTransfer[]
  failed: PendingTransfer[]
}

// After the switch, the Google account takes each home. One that cannot be taken (the ticket expired, the
// account is already in that home as another person) is left behind and the others still move.
export const claimTickets = async (
  db: Firestore,
  uid: string,
  pending: PendingTransfer[],
): Promise<TransferResult> => {
  const outcomes = await Promise.all(
    pending.map(async (transfer) => {
      try {
        await claimTransferTicket(db, {
          flatId: transfer.flatId,
          memberId: transfer.memberId,
          fromUid: transfer.fromUid,
          secret: transfer.secret,
          uid,
          flatName: transfer.name,
        })
        // The ticket has done its job: it is removed now that the account holds the member. If this
        // fails it stays, expired and useless, until the same member leaves a new one over it.
        await deleteTransferTicket(db, {
          flatId: transfer.flatId,
          memberId: transfer.memberId,
        }).catch(() => undefined)
        return { transfer, ok: true }
      } catch {
        return { transfer, ok: false }
      }
    }),
  )
  return {
    moved: outcomes.filter((outcome) => outcome.ok).map((outcome) => outcome.transfer),
    failed: outcomes.filter((outcome) => !outcome.ok).map((outcome) => outcome.transfer),
  }
}
