import { useState } from 'react'
import { Button, Stack } from '@mui/material'
import { CreateFlatForm } from '../components/CreateFlatForm'
import { GoogleGate } from '../components/GoogleGate'
import { JoinFlat } from '../components/JoinFlat'
import { MyFlats, type FlatChoice } from '../components/MyFlats'
import { SavedFlats } from '../components/SavedFlats'
import { StartBackdrop } from '../components/StartBackdrop'
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
  type MyFlat,
} from '../firebase/flatRepository'
import { GoogleAccessError, isGoogleUser, type AuthUserInfo } from '../firebase/googleAccess'
import { openGoogle } from '../firebase/googleSignIn'
import type { SavedFlat } from '../storage/session'
import { describeError } from '../i18n/describeError'
import { reportFirestoreError } from '../monitoring/errorReport'
import { useTranslation } from '../i18n/useTranslation'

interface OnboardingScreenProps {
  user: AuthUserInfo
  // The flat that was created, joined or found: the app remembers it with the others
  onDone: (flat: SavedFlat) => void
  // The flats this device already has, to go back to one of them
  savedFlats?: SavedFlat[]
  currentFlatId?: string | null
  onOpenSaved?: (flatId: string) => void
  // Present when there is already a flat to go back to
  onCancel?: () => void
  // Signing in to a Google account that already exists changes the identity of the device: the app
  // leaves the homes it holds behind (`before`, while the old identity still works) and takes them to the
  // account (`after`, which gives back the homes the account has now)
  accountSwitch?: {
    before: () => Promise<void>
    after: (uid: string) => Promise<MyFlat[]>
  }
  // Where it opens: the start, or directly the form to create or to join
  initialView?: 'welcome' | 'create' | 'join'
}

type View = 'welcome' | 'google-create' | 'create' | 'join' | 'my-flats'

interface FoundFlat {
  flatId: string
  flatName: string
  candidates: MemberRecord[]
  // Everybody in the flat, to know which colors are taken
  members: MemberRecord[]
}

// The colors the people of the flat have, with their name: a color is only shown to a joiner when nobody else has it
const colorsTakenBy = (members: MemberRecord[]): Record<string, string> =>
  Object.fromEntries(members.filter((member) => member.active).map((m) => [m.color, m.name]))

export const OnboardingScreen = ({
  user,
  onDone,
  savedFlats = [],
  currentFlatId = null,
  onOpenSaved,
  onCancel,
  accountSwitch,
  initialView = 'welcome',
}: OnboardingScreenProps) => {
  const { t } = useTranslation()
  const [view, setView] = useState<View>(() =>
    initialView === 'create' ? (isGoogleUser(user) ? 'create' : 'google-create') : initialView,
  )
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

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (failure) {
      reportFirestoreError(failure)
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
      const outcome = await openGoogle(getFirebase().auth, undefined, {
        beforeSwitch: accountSwitch?.before,
      })
      if (outcome.kind === 'signed-in') await accountSwitch?.after(outcome.uid)
      setView('create')
    })

  // Opens Google right away: the click is the gesture the browser needs to allow the window
  const signInToFindFlats = () => {
    setView('my-flats')
    setError(null)
    setMyFlats(null)
    return run(async () => {
      const outcome = await openGoogle(getFirebase().auth, undefined, {
        beforeSwitch: accountSwitch?.before,
      })
      setMyFlats(
        outcome.kind === 'signed-in' && accountSwitch
          ? await accountSwitch.after(outcome.uid)
          : await listMyFlats(getFirebase().db, outcome.uid),
      )
    })
  }

  const create = (draft: FlatDraft, ownerName: string, ownerColor: string) =>
    run(async () => {
      const created = await createFlat(getFirebase().db, {
        draft,
        ownerUid: user.uid,
        ownerName,
        ownerColor,
        generateCode: () => generateInviteCode(Math.random),
      })
      onDone({ flatId: created.flatId, memberId: created.memberId, name: draft.name })
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
        members,
      })
    })

  const pick = (memberId: string, color: string) =>
    run(async () => {
      if (found === null) return
      await joinFlat(getFirebase().db, {
        flatId: found.flatId,
        memberId,
        uid: user.uid,
        flatName: found.flatName,
        color,
        hasGoogle: isGoogleUser(user),
      })
      onDone({ flatId: found.flatId, memberId, name: found.flatName })
    })

  return (
    <>
      <StartBackdrop />
      {view === 'google-create' ? (
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
          takenBy={found === null ? {} : colorsTakenBy(found.members)}
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
          onOpen={(flat) =>
            onDone({ flatId: flat.flatId, memberId: flat.memberId, name: flat.flatName })
          }
          onBack={() => go('welcome')}
        />
      ) : (
        <Stack spacing={2}>
          {onOpenSaved ? (
            <SavedFlats flats={savedFlats} currentFlatId={currentFlatId} onOpen={onOpenSaved} />
          ) : null}
          <Welcome
            onCreate={startCreating}
            onJoin={() => go('join')}
            onSignIn={signInToFindFlats}
            showSignIn={!isGoogleUser(user)}
            compact={onOpenSaved !== undefined && savedFlats.length > 0}
          />
          {onCancel ? <Button onClick={onCancel}>{t('flats.back')}</Button> : null}
        </Stack>
      )}
    </>
  )
}
