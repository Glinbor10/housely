import { useState } from 'react'
import { Alert, Box, Button, Skeleton, Stack, Typography } from '@mui/material'
import { BottomTabs, type Tab } from '../components/BottomTabs'
import { HistoryView } from '../components/HistoryView'
import { InviteCode } from '../components/InviteCode'
import { MembersList } from '../components/MembersList'
import { SaveAccessBanner } from '../components/SaveAccessBanner'
import { ThisWeek } from '../components/ThisWeek'
import { TricountLink } from '../components/TricountLink'
import { findCompletion, toIsoDate, type Completion } from '../domain/completions'
import { buildHistory, personStats, zoneStats } from '../domain/history'
import { baseLayout } from '../domain/layouts'
import { getAssignments, getRestingMembers, getWeekIndex } from '../domain/rotation'
import { getFirebase } from '../firebase/app'
import {
  forgetFlat,
  releaseMember,
  saveCompletion,
  setTricountUrl,
  subscribeCompletions,
  subscribeFlat,
  subscribeMembers,
  type CompletionRecord,
  type FlatRecord,
  type MemberRecord,
} from '../firebase/flatRepository'
import { openGoogle } from '../firebase/googleSignIn'
import { buzz, celebrate } from '../effects/celebrate'
import { useAction } from '../hooks/useAction'
import { useSubscription } from '../hooks/useSubscription'
import { dismissSaveAccess, isSaveAccessDismissed } from '../storage/preferences'
import { getBrowserStorage, type Session } from '../storage/session'
import { useTranslation } from '../i18n/useTranslation'

interface FlatScreenProps {
  uid: string
  // True when the identity has Google linked; flatmates who joined anonymously are invited to link it
  isGoogle: boolean
  session: Session
  onLeave: () => void
}

export const FlatScreen = ({ uid, isGoogle, session, onLeave }: FlatScreenProps) => {
  const { t } = useTranslation()
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
  const save = useAction()
  const tricount = useAction()
  const release = useAction()
  const linking = useAction()
  const [bannerDismissed, setBannerDismissed] = useState(() =>
    isSaveAccessDismissed(getBrowserStorage()),
  )

  const failure = flat.error ?? members.error ?? completions.error
  const leave = (
    <Button variant="outlined" onClick={onLeave}>
      {t('flat.leave')}
    </Button>
  )
  // Access was lost (for example, the owner released this identity): the entry that points to the
  // flat is stale, so it is forgotten together with the local session.
  const leaveLostFlat = (
    <Button
      variant="outlined"
      onClick={() => {
        forgetFlat(db, uid, flatId).catch(() => undefined)
        onLeave()
      }}
    >
      {t('flat.leave')}
    </Button>
  )

  return failure || (flat.ready && flat.value === null) ? (
    <Stack spacing={2}>
      <Alert severity="error">
        {t('flat.unavailable')}
        {failure ? ` (${failure.message})` : ''}
      </Alert>
      {leaveLostFlat}
    </Stack>
  ) : !flat.ready || !members.ready || !completions.ready || flat.value === null ? (
    <Stack spacing={2} aria-busy="true" aria-label={t('common.loading')} role="status">
      <Skeleton variant="text" width="60%" height={48} />
      <Skeleton variant="rounded" height={116} />
      <Skeleton variant="rounded" height={96} />
      <Skeleton variant="rounded" height={96} />
    </Stack>
  ) : (
    <Stack spacing={2}>
      {!isGoogle && !bannerDismissed ? (
        <SaveAccessBanner
          busy={linking.busy}
          error={linking.error}
          onSave={() =>
            linking.run(async () => {
              // Only link: switching to another account would lose access to this flat
              await openGoogle(getFirebase().auth, undefined, { allowSwitch: false })
            })
          }
          onDismiss={() => {
            dismissSaveAccess(getBrowserStorage())
            setBannerDismissed(true)
          }}
        />
      ) : null}
      <FlatContent
        flat={flat.value}
        members={members.value}
        completions={completions.value}
        session={session}
        isOwner={flat.value.ownerUid === uid}
        now={now}
        saveError={save.error}
        tricountBusy={tricount.busy}
        tricountError={tricount.error}
        releaseBusy={release.busy}
        releaseError={release.error}
        onSaveTricount={(url) => tricount.run(() => setTricountUrl(db, flatId, url))}
        onSave={(record) => save.run(() => saveCompletion(db, flatId, record))}
        onRelease={(memberId) => {
          const member = members.value.find((candidate) => candidate.id === memberId)
          return member?.uid
            ? release.run(() => releaseMember(db, { flatId, memberId, uid: member.uid as string }))
            : undefined
        }}
        leave={leave}
      />
    </Stack>
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
  releaseBusy: boolean
  releaseError: string | null
  onSaveTricount: (url: string | null) => void
  onSave: (record: CompletionRecord) => Promise<boolean>
  onRelease: (memberId: string) => void
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
  releaseBusy,
  releaseError,
  onSaveTricount,
  onSave,
  onRelease,
  leave,
}: FlatContentProps) => {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('week')
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

  // Until the rotation can be edited every flat has a single layout: its current people and zones
  const history = buildHistory({
    layouts: [baseLayout(members, flat.zones)],
    completions,
    currentWeek: weekIndex,
    startDate: flat.startDate,
  })

  // Marking the last pending zone is what makes the week clean
  const finishesWeek = (zone: string): boolean => {
    const pending = assignments.filter((entry) => !findCompletion(done, weekIndex, entry.zone))
    return pending.length === 1 && pending[0].zone === zone
  }

  const markDone = async (entry: Completion) => {
    const completesTheWeek = finishesWeek(entry.zone)
    const saved = await onSave({
      weekIndex: entry.weekIndex,
      zone: entry.zone,
      memberId: session.memberId,
      doneAt: entry.doneAt,
    })
    // Celebrate only what really got saved
    if (saved) {
      buzz()
      if (completesTheWeek) await celebrate()
    }
  }

  return (
    <>
      <Stack spacing={2} sx={{ pb: 12 }}>
        <Box>
          <Typography variant="h4" component="h1">
            {flat.name}
          </Typography>
          {tab === 'week' ? (
            <Typography color="text.secondary">{t('week.title', { n: weekIndex + 1 })}</Typography>
          ) : null}
        </Box>
        {tab === 'week' ? (
          <>
            {saveError ? <Alert severity="error">{saveError}</Alert> : null}
            <ThisWeek
              weekIndex={weekIndex}
              assignments={assignments}
              completions={done}
              currentMember={names.get(session.memberId) ?? ''}
              colors={Object.fromEntries(members.map((member) => [member.name, member.color]))}
              today={toIsoDate(now)}
              onMarkDone={markDone}
            />
            {resting.length > 0 ? (
              <Typography color="text.secondary">
                {t('week.resting', { names: resting.join(', ') })}
              </Typography>
            ) : null}
          </>
        ) : tab === 'history' ? (
          <HistoryView
            weeks={history}
            names={Object.fromEntries(names)}
            currentWeek={weekIndex}
            people={personStats(history, weekIndex)}
            zones={zoneStats(history, weekIndex)}
          />
        ) : tab === 'people' ? (
          <>
            <MembersList
              members={members.map((member) => ({
                id: member.id,
                name: member.name,
                claimed: member.uid !== null,
              }))}
              currentMemberId={session.memberId}
              canManage={isOwner}
              busy={releaseBusy}
              error={releaseError}
              onRelease={onRelease}
            />
            <InviteCode code={flat.inviteCode} appUrl={window.location.origin} />
          </>
        ) : (
          <>
            <TricountLink
              url={flat.tricountUrl}
              canEdit={isOwner}
              busy={tricountBusy}
              error={tricountError}
              onSave={onSaveTricount}
            />
            {leave}
          </>
        )}
      </Stack>
      <BottomTabs value={tab} onChange={setTab} />
    </>
  )
}
