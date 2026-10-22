import { useState } from 'react'
import { Alert, Box, Button, Skeleton, Stack, Typography } from '@mui/material'
import { BottomTabs, type Tab } from '../components/BottomTabs'
import { HistoryView } from '../components/HistoryView'
import { RotationEditor } from '../components/RotationEditor'
import { SettingsView } from '../components/SettingsView'
import { InviteCode } from '../components/InviteCode'
import { MembersList } from '../components/MembersList'
import { SaveAccessBanner } from '../components/SaveAccessBanner'
import { ThisWeek } from '../components/ThisWeek'
import { TricountLink } from '../components/TricountLink'
import { findCompletion, toIsoDate, type Completion } from '../domain/completions'
import { buildHistory, personStats, weekStartDate, zoneStats } from '../domain/history'
import { baseLayout, layoutForWeek, type RotationLayout } from '../domain/layouts'
import { planRotationEdit, type RotationEdit, type RotationPlan } from '../domain/rotationEdit'
import { getAssignments, getRestingMembers, getWeekIndex } from '../domain/rotation'
import { getFirebase } from '../firebase/app'
import {
  forgetFlat,
  releaseMember,
  saveCompletion,
  saveRotation,
  setTricountUrl,
  subscribeCompletions,
  subscribeFlat,
  subscribeLayouts,
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

// Shown in the settings. The release workflow injects the real one; a local build has none.
const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? '0.0.0-dev'

interface FlatScreenProps {
  uid: string
  // True when the identity has Google linked; flatmates who joined anonymously are invited to link it
  isGoogle: boolean
  // Email of the linked Google account, when there is one
  accountEmail: string | null
  session: Session
  onLeave: () => void
}

export const FlatScreen = ({ uid, isGoogle, accountEmail, session, onLeave }: FlatScreenProps) => {
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
  const layouts = useSubscription<RotationLayout[]>(
    flatId,
    (onValue, onError) => subscribeLayouts(db, flatId, onValue, onError),
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
  const rotation = useAction()
  const linking = useAction()
  const [bannerDismissed, setBannerDismissed] = useState(() =>
    isSaveAccessDismissed(getBrowserStorage()),
  )

  const failure = flat.error ?? members.error ?? completions.error ?? layouts.error
  // Only link: switching to another account would lose access to this flat
  const linkGoogle = () =>
    linking.run(async () => {
      await openGoogle(getFirebase().auth, undefined, { allowSwitch: false })
    })

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
  ) : !flat.ready ||
    !members.ready ||
    !completions.ready ||
    !layouts.ready ||
    flat.value === null ? (
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
          onSave={linkGoogle}
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
        layouts={layouts.value}
        session={session}
        isOwner={flat.value.ownerUid === uid}
        now={now}
        saveError={save.error}
        tricountBusy={tricount.busy}
        tricountError={tricount.error}
        releaseBusy={release.busy}
        releaseError={release.error}
        rotationBusy={rotation.busy}
        rotationError={rotation.error}
        onSaveRotation={(plan) => rotation.run(() => saveRotation(db, flatId, plan))}
        onSaveTricount={(url) => tricount.run(() => setTricountUrl(db, flatId, url))}
        onSave={(record) => save.run(() => saveCompletion(db, flatId, record))}
        onRelease={(memberId) => {
          const member = members.value.find((candidate) => candidate.id === memberId)
          return member?.uid
            ? release.run(() => releaseMember(db, { flatId, memberId, uid: member.uid as string }))
            : undefined
        }}
        isGoogle={isGoogle}
        accountEmail={accountEmail}
        linkBusy={linking.busy}
        linkError={linking.error}
        onLinkGoogle={linkGoogle}
        onLeave={onLeave}
      />
    </Stack>
  )
}

interface FlatContentProps {
  flat: FlatRecord
  members: MemberRecord[]
  completions: CompletionRecord[]
  layouts: RotationLayout[]
  session: Session
  isOwner: boolean
  now: Date
  saveError: string | null
  tricountBusy: boolean
  tricountError: string | null
  releaseBusy: boolean
  releaseError: string | null
  rotationBusy: boolean
  rotationError: string | null
  onSaveRotation: (plan: RotationPlan) => Promise<boolean>
  onSaveTricount: (url: string | null) => void
  onSave: (record: CompletionRecord) => Promise<boolean>
  onRelease: (memberId: string) => void
  isGoogle: boolean
  accountEmail: string | null
  linkBusy: boolean
  linkError: string | null
  onLinkGoogle: () => void
  onLeave: () => void
}

const FlatContent = ({
  flat,
  members,
  completions,
  layouts,
  session,
  isOwner,
  now,
  saveError,
  tricountBusy,
  tricountError,
  releaseBusy,
  releaseError,
  rotationBusy,
  rotationError,
  onSaveRotation,
  onSaveTricount,
  onSave,
  onRelease,
  isGoogle,
  accountEmail,
  linkBusy,
  linkError,
  onLinkGoogle,
  onLeave,
}: FlatContentProps) => {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('week')
  const [editing, setEditing] = useState(false)
  const [problems, setProblems] = useState<string[]>([])
  const names = new Map(members.map((member) => [member.id, member.name]))
  const weekIndex = getWeekIndex(new Date(`${flat.startDate}T00:00:00`), now)
  // A flat that never edited its rotation has a single implicit layout: its people and zones
  const effective = layouts.length > 0 ? layouts : [baseLayout(members, flat.zones)]
  // Each week is read with the layout that was in force then
  const layout = layoutForWeek(effective, weekIndex)
  const assignments = (layout ? getAssignments(layout.members, layout.zones, weekIndex) : []).map(
    ({ zone, member }) => ({ zone, member: names.get(member) ?? '?' }),
  )
  const resting =
    layout && layout.members.length > 0
      ? getRestingMembers(layout.members, layout.zones, weekIndex).map((id) => names.get(id) ?? '?')
      : []
  const done: Completion[] = completions.map((record) => ({
    weekIndex: record.weekIndex,
    zone: record.zone,
    member: names.get(record.memberId) ?? '?',
    doneAt: record.doneAt,
  }))

  const history = buildHistory({
    layouts: effective,
    completions,
    currentWeek: weekIndex,
    startDate: flat.startDate,
  })

  // The people of the latest layout (the one that applies from next week, if there is one) and the
  // zones: what the owner starts from when editing
  const latest = [...effective].sort((a, b) => a.fromWeek - b.fromWeek).at(-1)
  const submitRotation = async (edit: RotationEdit) => {
    const result = planRotationEdit({
      members,
      zones: flat.zones,
      storedLayouts: layouts,
      edit,
      currentWeek: weekIndex,
    })
    if (!result.ok) {
      setProblems(result.errors)
      return
    }
    setProblems([])
    if (await onSaveRotation(result.plan)) setEditing(false)
  }

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
        ) : tab === 'settings' ? (
          <SettingsView
            isGoogle={isGoogle}
            accountEmail={accountEmail}
            linkBusy={linkBusy}
            linkError={linkError}
            version={APP_VERSION}
            onLinkGoogle={onLinkGoogle}
            onLeave={onLeave}
          />
        ) : isOwner && editing ? (
          <RotationEditor
            people={(latest?.members ?? []).map((id) => ({ id, name: names.get(id) ?? '?' }))}
            zones={flat.zones}
            canAddPeople={members.length < 20}
            appliesFrom={weekStartDate(flat.startDate, weekIndex + 1)}
            problems={problems}
            busy={rotationBusy}
            error={rotationError}
            onSave={submitRotation}
            onCancel={() => {
              setProblems([])
              setEditing(false)
            }}
          />
        ) : (
          <>
            <TricountLink
              url={flat.tricountUrl}
              canEdit={isOwner}
              busy={tricountBusy}
              error={tricountError}
              onSave={onSaveTricount}
            />
            <MembersList
              members={members
                .filter((member) => member.active)
                .map((member) => ({
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
            {isOwner ? (
              <Button variant="outlined" onClick={() => setEditing(true)}>
                {t('rotation.edit')}
              </Button>
            ) : null}
          </>
        )}
      </Stack>
      <BottomTabs value={tab} onChange={setTab} />
    </>
  )
}
