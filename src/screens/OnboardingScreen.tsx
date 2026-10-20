import { useState } from 'react'
import { CreateFlatForm } from '../components/CreateFlatForm'
import { GoogleGate } from '../components/GoogleGate'
import { JoinFlat } from '../components/JoinFlat'
import { MyFlats, type FlatChoice } from '../components/MyFlats'
import { Welcome } from '../components/Welcome'
import { generateInviteCode, getMondayIso, type FlatDraft } from '../domain/flat'
import { getFirebase } from '../firebase/app'
import {
  createFlat,
  findFlatByCode,
  joinFlat,
  listMembers,
  listMyFlats,
  type MemberRecord,
} from '../firebase/flatRepository'
import { GoogleAccessError, isGoogleUser, type AuthUserInfo } from '../firebase/googleAccess'
import { openGoogle } from '../firebase/googleSignIn'
import { getBrowserStorage, saveSession, type Session } from '../storage/session'
import { describeError } from '../i18n/describeError'
import { useTranslation } from '../i18n/useTranslation'

interface OnboardingScreenProps {
  user: AuthUserInfo
  onDone: (session: Session) => void
}

type View = 'welcome' | 'google-create' | 'create' | 'join' | 'my-flats'

interface FoundFlat {
  flatId: string
  flatName: string
  candidates: MemberRecord[]
}

export const OnboardingScreen = ({ user, onDone }: OnboardingScreenProps) => {
  const { t } = useTranslation()
  const [view, setView] = useState<View>('welcome')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [found, setFound] = useState<FoundFlat | null>(null)
  const [myFlats, setMyFlats] = useState<FlatChoice[] | null>(null)
  // Captured once: the default start of the rotation is the Monday of the week the flat is created
  const [defaultStart] = useState(() => getMondayIso(new Date()))

  const go = (next: View) => {
    setView(next)
    setError(null)
    setFound(null)
    setMyFlats(null)
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
      // Closing the Google window is a choice, not a problem
      if (!(failure instanceof GoogleAccessError && failure.code === 'cancelled')) {
        setError(describeError(failure))
      }
    } finally {
      setBusy(false)
    }
  }

  const startCreating = () => go(isGoogleUser(user) ? 'create' : 'google-create')

  const continueWithGoogleToCreate = () =>
    run(async () => {
      await openGoogle(getFirebase().auth)
      setView('create')
    })

  // Opens Google right away: the click is the gesture the browser needs to allow the window
  const signInToFindFlats = () => {
    setView('my-flats')
    setError(null)
    setMyFlats(null)
    return run(async () => {
      const outcome = await openGoogle(getFirebase().auth)
      setMyFlats(await listMyFlats(getFirebase().db, outcome.uid))
    })
  }

  const create = (draft: FlatDraft, ownerName: string) =>
    run(async () => {
      const created = await createFlat(getFirebase().db, {
        draft,
        ownerUid: user.uid,
        ownerName,
        generateCode: () => generateInviteCode(Math.random),
      })
      finish({ flatId: created.flatId, memberId: created.memberId })
    })

  const find = (code: string) =>
    run(async () => {
      const { db } = getFirebase()
      const flat = await findFlatByCode(db, code)
      if (flat === null) {
        setError(t('join.unknownCode'))
        return
      }
      const members = await listMembers(db, flat.flatId)
      setFound({
        ...flat,
        candidates: members.filter((member) => member.uid === null && member.active),
      })
    })

  const pick = (memberId: string) =>
    run(async () => {
      if (found === null) return
      await joinFlat(getFirebase().db, {
        flatId: found.flatId,
        memberId,
        uid: user.uid,
        flatName: found.flatName,
      })
      finish({ flatId: found.flatId, memberId })
    })

  return view === 'google-create' ? (
    <GoogleGate
      busy={busy}
      error={error}
      onContinue={continueWithGoogleToCreate}
      onBack={() => go('welcome')}
    />
  ) : view === 'create' ? (
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
      flatName={found?.flatName}
      busy={busy}
      error={error}
      onFind={find}
      onPick={pick}
      onBack={() => go('welcome')}
    />
  ) : view === 'my-flats' ? (
    <MyFlats
      flats={myFlats}
      busy={busy}
      error={error}
      onOpen={(flat) => finish({ flatId: flat.flatId, memberId: flat.memberId })}
      onBack={() => go('welcome')}
    />
  ) : (
    <Welcome onCreate={startCreating} onJoin={() => go('join')} onSignIn={signInToFindFlats} />
  )
}
