import { useState } from 'react'
import { CreateFlatForm } from '../components/CreateFlatForm'
import { JoinFlat } from '../components/JoinFlat'
import { Welcome } from '../components/Welcome'
import { generateInviteCode, getMondayIso, type FlatDraft } from '../domain/flat'
import { getFirebase } from '../firebase/app'
import {
  createFlat,
  findFlatIdByCode,
  joinFlat,
  listMembers,
  type MemberRecord,
} from '../firebase/flatRepository'
import { getBrowserStorage, saveSession, type Session } from '../storage/session'

interface OnboardingScreenProps {
  uid: string
  onDone: (session: Session) => void
}

type View = 'welcome' | 'create' | 'join'

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : 'Something went wrong. Try again.'

export const OnboardingScreen = ({ uid, onDone }: OnboardingScreenProps) => {
  const [view, setView] = useState<View>('welcome')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [found, setFound] = useState<{ flatId: string; candidates: MemberRecord[] } | null>(null)
  // Captured once: the default start of the rotation is the Monday of the week the flat is created
  const [defaultStart] = useState(() => getMondayIso(new Date()))

  const go = (next: View) => {
    setView(next)
    setError(null)
    setFound(null)
  }

  const finish = (session: Session) => {
    saveSession(getBrowserStorage(), session)
    onDone(session)
  }

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (failure) {
      setError(messageOf(failure))
    } finally {
      setBusy(false)
    }
  }

  const create = (draft: FlatDraft, ownerName: string) =>
    run(async () => {
      const created = await createFlat(getFirebase().db, {
        draft,
        ownerUid: uid,
        ownerName,
        generateCode: () => generateInviteCode(Math.random),
      })
      finish({ flatId: created.flatId, memberId: created.memberId })
    })

  const find = (code: string) =>
    run(async () => {
      const { db } = getFirebase()
      const flatId = await findFlatIdByCode(db, code)
      if (flatId === null) {
        setError('That invite code does not exist. Check it and try again.')
        return
      }
      const members = await listMembers(db, flatId)
      setFound({
        flatId,
        candidates: members.filter((member) => member.uid === null && member.active),
      })
    })

  const pick = (memberId: string) =>
    run(async () => {
      if (found === null) return
      await joinFlat(getFirebase().db, { flatId: found.flatId, memberId, uid })
      finish({ flatId: found.flatId, memberId })
    })

  return view === 'create' ? (
    <CreateFlatForm
      initialStartDate={defaultStart}
      busy={busy}
      submitError={error}
      onSubmit={create}
      onBack={() => go('welcome')}
    />
  ) : view === 'join' ? (
    <JoinFlat
      candidates={found === null ? null : found.candidates}
      busy={busy}
      error={error}
      onFind={find}
      onPick={pick}
      onBack={() => go('welcome')}
    />
  ) : (
    <Welcome onCreate={() => go('create')} onJoin={() => go('join')} />
  )
}
