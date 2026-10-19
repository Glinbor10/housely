import { useState } from 'react'
import { Alert, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { ThisWeek } from '../components/ThisWeek'
import { TricountLink } from '../components/TricountLink'
import { toIsoDate, type Completion } from '../domain/completions'
import { getAssignments, getRestingMembers, getWeekIndex } from '../domain/rotation'
import { getFirebase } from '../firebase/app'
import {
  saveCompletion,
  subscribeCompletions,
  subscribeFlat,
  setTricountUrl,
  subscribeMembers,
  type CompletionRecord,
  type FlatRecord,
  type MemberRecord,
} from '../firebase/flatRepository'
import { useSubscription } from '../hooks/useSubscription'
import type { Session } from '../storage/session'

interface FlatScreenProps {
  uid: string
  session: Session
  onLeave: () => void
}

export const FlatScreen = ({ uid, session, onLeave }: FlatScreenProps) => {
  const { db } = getFirebase()
  const { flatId } = session
  const flat = useSubscription<FlatRecord | null>(
    flatId,
    (onValue, onError) => subscribeFlat(db, flatId, onValue, onError),
    null,
  )
  const members = useSubscription<MemberRecord[]>(
    flatId,
    (onValue, onError) => subscribeMembers(db, flatId, onValue, onError),
    [],
  )
  const completions = useSubscription<CompletionRecord[]>(
    flatId,
    (onValue, onError) => subscribeCompletions(db, flatId, onValue, onError),
    [],
  )
  // Captured once: keeps render pure and the date stable while the screen is open
  const [now] = useState(() => new Date())
  const [saveError, setSaveError] = useState<string | null>(null)
  const [tricountBusy, setTricountBusy] = useState(false)
  const [tricountError, setTricountError] = useState<string | null>(null)

  const failure = flat.error ?? members.error ?? completions.error
  const leave = (
    <Button variant="outlined" onClick={onLeave}>
      Leave this flat on this device
    </Button>
  )

  return failure || (flat.ready && flat.value === null) ? (
    <Stack spacing={2}>
      <Alert severity="error">
        This flat is not available. You may have lost access to it.
        {failure ? ` (${failure.message})` : ''}
      </Alert>
      {leave}
    </Stack>
  ) : !flat.ready || !members.ready || !completions.ready || flat.value === null ? (
    <Stack sx={{ alignItems: 'center', py: 6 }}>
      <CircularProgress aria-label="Loading" />
    </Stack>
  ) : (
    <FlatContent
      flat={flat.value}
      members={members.value}
      completions={completions.value}
      session={session}
      isOwner={flat.value.ownerUid === uid}
      now={now}
      saveError={saveError}
      tricountBusy={tricountBusy}
      tricountError={tricountError}
      onSaveTricount={async (url) => {
        setTricountBusy(true)
        setTricountError(null)
        try {
          await setTricountUrl(db, flatId, url)
        } catch (error) {
          setTricountError(error instanceof Error ? error.message : 'Could not save. Try again.')
        } finally {
          setTricountBusy(false)
        }
      }}
      onSave={async (record) => {
        setSaveError(null)
        try {
          await saveCompletion(db, flatId, record)
        } catch (error) {
          setSaveError(error instanceof Error ? error.message : 'Could not save. Try again.')
        }
      }}
      leave={leave}
    />
  )
}

interface FlatContentProps {
  flat: FlatRecord
  members: MemberRecord[]
  completions: CompletionRecord[]
  session: Session
  isOwner: boolean
  now: Date
  saveError: string | null
  tricountBusy: boolean
  tricountError: string | null
  onSaveTricount: (url: string | null) => void
  onSave: (record: CompletionRecord) => void
  leave: React.ReactNode
}

const FlatContent = ({
  flat,
  members,
  completions,
  session,
  isOwner,
  now,
  saveError,
  tricountBusy,
  tricountError,
  onSaveTricount,
  onSave,
  leave,
}: FlatContentProps) => {
  const names = new Map(members.map((member) => [member.id, member.name]))
  const weekIndex = getWeekIndex(new Date(`${flat.startDate}T00:00:00`), now)
  const assignments = getAssignments(
    members.filter((member) => member.active),
    flat.zones,
    weekIndex,
  ).map(({ zone, member }) => ({ zone, member: member.name }))
  const resting = getRestingMembers(
    members.filter((member) => member.active),
    flat.zones,
    weekIndex,
  ).map((member) => member.name)
  const done: Completion[] = completions.map((record) => ({
    weekIndex: record.weekIndex,
    zone: record.zone,
    member: names.get(record.memberId) ?? '?',
    doneAt: record.doneAt,
  }))

  return (
    <Stack spacing={2}>
      <Typography variant="h4">{flat.name}</Typography>
      <Typography color="text.secondary">
        Week {weekIndex + 1} · invite code <strong>{flat.inviteCode}</strong>
      </Typography>
      {saveError ? <Alert severity="error">{saveError}</Alert> : null}
      <ThisWeek
        weekIndex={weekIndex}
        assignments={assignments}
        completions={done}
        currentMember={names.get(session.memberId) ?? ''}
        today={toIsoDate(now)}
        onMarkDone={(entry) =>
          onSave({
            weekIndex: entry.weekIndex,
            zone: entry.zone,
            memberId: session.memberId,
            doneAt: entry.doneAt,
          })
        }
      />
      {resting.length > 0 ? (
        <Typography color="text.secondary">Free this week: {resting.join(', ')}</Typography>
      ) : null}
      <TricountLink
        url={flat.tricountUrl}
        canEdit={isOwner}
        busy={tricountBusy}
        error={tricountError}
        onSave={onSaveTricount}
      />
      {leave}
    </Stack>
  )
}
