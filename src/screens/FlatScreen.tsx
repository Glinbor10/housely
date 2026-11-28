import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { MIN_TOUCH_TARGET } from '../theme'
import { m } from 'motion/react'
import { signOut } from 'firebase/auth'
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  LinearProgress,
  ListItemText,
  Menu,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { BottomTabs, type Tab } from '../components/BottomTabs'
import { OfflineNotice } from '../components/OfflineNotice'
import { HistoryView } from '../components/HistoryView'
import { ExpensePeriodBanner } from '../components/ExpensePeriodBanner'
import { RotationEditor } from '../components/RotationEditor'
import { TakeoverNotices, type TakeoverNotice } from '../components/TakeoverNotices'
import { SettingsView } from '../components/SettingsView'
import { InviteCode } from '../components/InviteCode'
import { layerBase, layerDepth, withDepth } from '../components/useLayer'
import { MembersList } from '../components/MembersList'
import { SaveAccessBanner } from '../components/SaveAccessBanner'
import { ThisWeek } from '../components/ThisWeek'
import { ExpensesView } from '../components/ExpensesView'
import { CheckIcon, ChevronDownIcon, EditIcon } from '../components/icons'
import type { ExpenseDraft } from '../components/ExpenseForm'
import { createNavigationStore } from '../hooks/navigationStore'
import { useOnline } from '../hooks/useOnline'
import { TricountLink } from '../components/TricountLink'
import { findCompletion, toIsoDate, type Completion } from '../domain/completions'
import { addMonths, formatDay, isWithinDays } from '../domain/dates'
import { validateFlatName } from '../domain/flat'
import {
  buildHistory,
  HISTORY_WINDOW,
  missedCounts,
  personStats,
  settledCleanings,
  weekEndDate,
  weekStartDate,
  zoneStats,
} from '../domain/history'
import { getMascotMood } from '../domain/mood'
import { baseLayout, layoutForWeek, type RotationLayout } from '../domain/layouts'
import { planRotationEdit, type RotationEdit, type RotationPlan } from '../domain/rotationEdit'
import type { Expense, Payment } from '../domain/expenses'
import { applyTakeovers, takeableCleanings, type Takeover } from '../domain/takeovers'
import type { Settlement } from '../domain/settlements'
import type { SettleInput } from '../components/SettleForm'
import { getAssignments, getDayInWeek, getRestingMembers, getWeekIndex } from '../domain/rotation'
import { getFirebase } from '../firebase/app'
import {
  deleteFlat,
  forgetFlat,
  handOverFlat,
  renameFlat,
  markMemberHasGoogle,
  releaseMember,
  removeMakeUp,
  removeSettlement,
  saveMakeUp,
  deleteCompletion,
  deleteExpense,
  saveCompletion,
  saveExpense,
  saveRotation,
  saveSettlement,
  setMemberColor,
  setTricountUrl,
  closePeriod,
  subscribeCompletions,
  subscribeFlat,
  subscribeLayouts,
  subscribeMembers,
  subscribeExpenses,
  subscribeSettlements,
  subscribeTakeovers,
  syncFlatName,
  type CompletionRecord,
  type MakeUp,
  updateExpense,
  type FlatRecord,
  type MemberRecord,
} from '../firebase/flatRepository'
import { openGoogle } from '../firebase/googleSignIn'
import { buzz, celebrate } from '../effects/celebrate'
import { useAction } from '../hooks/useAction'
import { useSubscription } from '../hooks/useSubscription'
import { dismissSaveAccess, isSaveAccessDismissed } from '../storage/preferences'
import { forgetFlats, getBrowserStorage, type Session } from '../storage/session'
import { logOut } from './logOut'
import { pickMascotLine } from '../domain/mascotLines'
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
  // Opens the start screen: create a flat, join with an invite code or find the flats of a Google account
  // The homes of the person, to switch from the header, and the way to create or join another
  savedFlats: Array<{ flatId: string; name: string }>
  onSwitchFlat: (flatId: string) => void
  onOpenSwitcher: () => void
  onChangeFlat: (at?: 'create' | 'join') => void
  // The name the open flat has now, so the list of flats shows it
  onFlatName: (name: string) => void
  onLeave: () => void
  // Linking Google to an account that already exists switches the identity: the homes go along with it
  accountSwitch: {
    before: () => Promise<void>
    after: (uid: string) => Promise<unknown>
  }
}

export const FlatScreen = ({
  uid,
  isGoogle,
  accountEmail,
  session,
  savedFlats,
  onSwitchFlat,
  onOpenSwitcher,
  onChangeFlat,
  onFlatName,
  onLeave,
  accountSwitch,
}: FlatScreenProps) => {
  const { t } = useTranslation()
  const { db } = getFirebase()
  const { flatId } = session
  const flat = useSubscription<FlatRecord | null>(
    flatId,
    (onValue, onError) =>
      subscribeFlat(
        db,
        flatId,
        (value) => {
          onValue(value)
          // Each person keeps their own copy of the name for their list of flats: when the owner
          // renames the flat, the copy is corrected here, as a side effect of the subscription
          if (value) {
            void syncFlatName(db, uid, flatId, value.name)
            // The list of flats of this device shows the name the flat has now
            onFlatName(value.name)
          }
        },
        onError,
      ),
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
  // Captured once: keeps render pure and the date stable while the screen is open
  const [now] = useState(() => new Date())
  // Completions, settlements and takeovers start only once the flat's start date is known, so the Firestore
  // query can include a week-index lower bound and skip the documents that will never be shown.
  const [fromWeek, setFromWeek] = useState<number | null>(null)
  useEffect(() => {
    if (flat.ready && flat.value && fromWeek === null) {
      const weekIdx = getWeekIndex(new Date(`${flat.value.startDate}T00:00:00`), now)
      setFromWeek(Math.max(0, weekIdx - HISTORY_WINDOW))
    }
  }, [flat.ready, flat.value, fromWeek, now])
  const completions = useSubscription<CompletionRecord[]>(
    fromWeek !== null ? `${flatId}-completions` : `${flatId}-completions-pending`,
    fromWeek !== null
      ? (onValue, onError) => subscribeCompletions(db, flatId, onValue, onError, fromWeek)
      : () => () => {},
    [],
  )
  const takeovers = useSubscription<Takeover[]>(
    fromWeek !== null ? `${flatId}-takeovers` : `${flatId}-takeovers-pending`,
    fromWeek !== null
      ? (onValue, onError) => subscribeTakeovers(db, flatId, onValue, onError, fromWeek)
      : () => () => {},
    [],
  )
  const settlements = useSubscription<Settlement[]>(
    fromWeek !== null ? `${flatId}-settlements` : `${flatId}-settlements-pending`,
    fromWeek !== null
      ? (onValue, onError) => subscribeSettlements(db, flatId, onValue, onError, fromWeek)
      : () => () => {},
    [],
  )
  const save = useAction()
  const tricount = useAction()
  const release = useAction()
  const rotation = useAction()
  const color = useAction()
  const settle = useAction()
  const undoSettlement = useAction()
  const renaming = useAction()
  const handingOver = useAction()
  const linking = useAction()
  const loggingOut = useAction()
  const deleting = useAction()
  const [bannerDismissed, setBannerDismissed] = useState(() =>
    isSaveAccessDismissed(getBrowserStorage()),
  )

  // Which reading failed and why, so a person can tell what happened instead of guessing
  const failures = [
    ['flat', flat.error],
    ['members', members.error],
    ['completions', completions.error],
    ['layouts', layouts.error],
    ['settlements', settlements.error],
    ['takeovers', takeovers.error],
  ] as const
  const failed = failures.find(([, error]) => error !== null)
  const failure = failed?.[1] ?? null
  const failureDetail = failed
    ? `${failed[0]}: ${'code' in failed[1]! ? String((failed[1] as { code: unknown }).code) : failed[1]!.message}`
    : flat.ready && flat.value === null
      ? 'flat: not found'
      : null
  const unavailable = Boolean(failure) || (flat.ready && flat.value === null)
  // The owner deletes the home for good: it takes over the screen while it lasts, because what the home
  // holds disappears piece by piece. If it was cut half way (the home is still there, marked), the owner
  // finds the same screen and can run it again.
  const interrupted =
    flat.ready && flat.value !== null && flat.value.ownerUid === uid && flat.value.deleting === true
  const removeFlatForGood = () => {
    const current = flat.value
    if (!current) return undefined
    return deleting.run(async () => {
      await deleteFlat(db, { flatId, uid, inviteCode: current.inviteCode })
      // The home is gone: this device forgets it before the screen notices
      onLeave()
    })
  }

  // Links the identity to Google. When Google already has an account for the person, the device
  // switches to it and the homes (this one too) go along with it
  const linkGoogle = () =>
    linking.run(async () => {
      const outcome = await openGoogle(getFirebase().auth, undefined, {
        beforeSwitch: accountSwitch.before,
      })
      if (outcome.kind === 'signed-in') {
        await accountSwitch.after(outcome.uid)
        return
      }
      // The token must carry the Google identity before the rules let the person say they have it
      await getFirebase().auth.currentUser?.getIdToken(true)
      await markMemberHasGoogle(db, flatId, session.memberId)
    })

  // Signing out forgets every flat of this device; the app restarts with a new anonymous identity
  const logOutOfDevice = () =>
    loggingOut.run(() =>
      logOut({
        signOut: () => signOut(getFirebase().auth),
        forgetFlats: () => forgetFlats(getBrowserStorage()),
        restart: () => window.location.reload(),
      }),
    )

  // Access was lost (for example, the owner released this identity): the entry that points to the
  // flat is stale, so it is forgotten together with the local session.
  const leaveButton = (label: string) => (
    <Button
      variant="outlined"
      onClick={() => {
        forgetFlat(db, uid, flatId).catch(() => undefined)
        onLeave()
      }}
    >
      {label}
    </Button>
  )

  return deleting.busy || deleting.error !== null || interrupted ? (
    <Stack spacing={2} role="status" aria-busy={deleting.busy}>
      {deleting.busy ? (
        <>
          <Typography>{t('flat.deleting')}</Typography>
          <LinearProgress />
        </>
      ) : (
        <>
          <Alert severity="error">
            {t('flat.deleteFailed')}
            {deleting.error ? (
              <Typography variant="caption" component="p" sx={{ mt: 0.5, opacity: 0.8 }}>
                {deleting.error}
              </Typography>
            ) : null}
          </Alert>
          <Button variant="contained" onClick={removeFlatForGood}>
            {t('flat.deleteRetry')}
          </Button>
        </>
      )}
    </Stack>
  ) : unavailable ? (
    <Stack spacing={2}>
      <Alert severity="error">
        {t('flat.unavailable')}
        {failureDetail ? (
          <Typography variant="caption" component="p" sx={{ mt: 0.5, opacity: 0.8 }}>
            {failureDetail}
          </Typography>
        ) : null}
      </Alert>
      {failure ? (
        <Button variant="contained" onClick={() => window.location.reload()}>
          {t('common.reload')}
        </Button>
      ) : null}
      {leaveButton(t('flat.leave'))}
    </Stack>
  ) : !flat.ready ||
    !members.ready ||
    !completions.ready ||
    !layouts.ready ||
    !settlements.ready ||
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
        settlements={settlements.value}
        takeovers={takeovers.value}
        session={session}
        isOwner={flat.value.ownerUid === uid}
        now={now}
        saveError={save.error}
        tricountBusy={tricount.busy}
        tricountError={tricount.error}
        releaseBusy={release.busy}
        releaseError={release.error}
        renameBusy={renaming.busy}
        renameError={renaming.error}
        handOverBusy={handingOver.busy}
        handOverError={handingOver.error}
        onRenameFlat={(name, inviteCode) =>
          renaming.run(() =>
            renameFlat(db, { flatId, inviteCode, uid, memberId: session.memberId, name }),
          )
        }
        onHandOver={(newOwnerUid, inviteCode) =>
          handingOver.run(() => handOverFlat(db, { flatId, inviteCode, newOwnerUid }))
        }
        settleBusy={settle.busy}
        settleError={settle.error ?? undoSettlement.error}
        onSettle={(input) =>
          settle.run(() => saveSettlement(db, flatId, { ...input, memberId: session.memberId }))
        }
        onMakeUp={(makeUp) => settle.run(() => saveMakeUp(db, flatId, makeUp))}
        onUndoMakeUp={(makeUp) => undoSettlement.run(() => removeMakeUp(db, flatId, makeUp))}
        onUndoSettlement={(weekIndex, zone) =>
          undoSettlement.run(() => removeSettlement(db, flatId, weekIndex, zone))
        }
        colorBusy={color.busy}
        onChangeColor={(hex) => color.run(() => setMemberColor(db, flatId, session.memberId, hex))}
        rotationBusy={rotation.busy}
        rotationError={rotation.error}
        onSaveRotation={(plan) => rotation.run(() => saveRotation(db, flatId, plan))}
        onSaveTricount={(url) => tricount.run(() => setTricountUrl(db, flatId, url))}
        onSave={(record) => save.run(() => saveCompletion(db, flatId, record))}
        onUndoDone={(weekIndex, zone) =>
          save.run(() => deleteCompletion(db, flatId, weekIndex, zone))
        }
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
        logOutBusy={loggingOut.busy}
        logOutError={loggingOut.error}
        onLogOut={logOutOfDevice}
        onDeleteFlat={removeFlatForGood}
        savedFlats={savedFlats}
        onSwitchFlat={onSwitchFlat}
        onOpenSwitcher={onOpenSwitcher}
        onChangeFlat={onChangeFlat}
        onClosePeriod={(nextCloseDate) => closePeriod(db, flatId, toIsoDate(now), nextCloseDate)}
      />
    </Stack>
  )
}

// Where the person is inside the flat: the section and the views opened inside it
interface Place {
  tab: Tab
  editing: boolean
  // The form or dialog that is open on top of the screen, if any
  layer: string | null
}

const HOME: Place = { tab: 'week', editing: false, layer: null }

// A reload comes back to where the person was, but only for the first flat that opens after the page
// loads: a flat opened from inside the app (changing flats, signing in again) starts in the week.
let canRestorePlace = true
const takeRestore = (): boolean => {
  const restore = canRestorePlace
  canRestorePlace = false
  return restore
}
const TABS: Tab[] = ['week', 'history', 'members', 'expenses', 'settings']

const isPlace = (value: unknown): value is Place => {
  const place = value as Partial<Place> | null
  return (
    typeof place === 'object' &&
    place !== null &&
    TABS.includes(place.tab as Tab) &&
    typeof place.editing === 'boolean' &&
    (place.layer === null || typeof place.layer === 'string')
  )
}

interface FlatContentProps {
  flat: FlatRecord
  members: MemberRecord[]
  completions: CompletionRecord[]
  layouts: RotationLayout[]
  settlements: Settlement[]
  takeovers: Takeover[]
  session: Session
  isOwner: boolean
  now: Date
  saveError: string | null
  tricountBusy: boolean
  tricountError: string | null
  releaseBusy: boolean
  releaseError: string | null
  renameBusy: boolean
  renameError: string | null
  handOverBusy: boolean
  handOverError: string | null
  onRenameFlat: (name: string, inviteCode: string) => Promise<boolean>
  onHandOver: (newOwnerUid: string, inviteCode: string) => Promise<boolean>
  settleBusy: boolean
  settleError: string | null
  onSettle: (input: SettleInput & { weekIndex: number; zone: string }) => Promise<boolean>
  onUndoSettlement: (weekIndex: number, zone: string) => void
  // A zone made up with a cleaning of a flatmate: both are written and undone together
  onMakeUp: (makeUp: MakeUp) => Promise<boolean>
  onUndoMakeUp: (makeUp: MakeUp) => void
  colorBusy: boolean
  onChangeColor: (hex: string) => void
  rotationBusy: boolean
  rotationError: string | null
  onSaveRotation: (plan: RotationPlan) => Promise<boolean>
  onSaveTricount: (url: string | null) => void
  onSave: (record: CompletionRecord) => Promise<boolean>
  onUndoDone: (weekIndex: number, zone: string) => Promise<boolean>
  onRelease: (memberId: string) => void
  isGoogle: boolean
  accountEmail: string | null
  linkBusy: boolean
  linkError: string | null
  onLinkGoogle: () => void
  // The homes of the person, to switch from the header, and the way to create or join another
  savedFlats: Array<{ flatId: string; name: string }>
  onSwitchFlat: (flatId: string) => void
  onOpenSwitcher: () => void
  onChangeFlat: (at?: 'create' | 'join') => void
  logOutBusy: boolean
  logOutError: string | null
  onLogOut: () => void
  onDeleteFlat: () => void
  onClosePeriod: (nextCloseDate: string) => Promise<void>
}

const FlatContent = ({
  flat,
  members,
  completions,
  layouts,
  settlements,
  takeovers,
  session,
  isOwner,
  now,
  saveError,
  tricountBusy,
  tricountError,
  releaseBusy,
  releaseError,
  renameBusy,
  renameError,
  handOverBusy,
  handOverError,
  onRenameFlat,
  onHandOver,
  settleBusy,
  settleError,
  onSettle,
  onUndoSettlement,
  onMakeUp,
  onUndoMakeUp,
  colorBusy,
  onChangeColor,
  rotationBusy,
  rotationError,
  onSaveRotation,
  onSaveTricount,
  onSave,
  onUndoDone,
  onRelease,
  isGoogle,
  accountEmail,
  linkBusy,
  linkError,
  onLinkGoogle,
  savedFlats,
  onSwitchFlat,
  onOpenSwitcher,
  onChangeFlat,
  logOutBusy,
  logOutError,
  onLogOut,
  onDeleteFlat,
  onClosePeriod,
}: FlatContentProps) => {
  const { db } = getFirebase()
  const expenseAction = useAction()
  // Expenses are subscribed only the first time the user opens the expenses view, so the initial
  // app load does not pay for a collection that may be large and is not needed on the week tab.
  const [expensesRequested, setExpensesRequested] = useState(false)
  const expenses = useSubscription<Expense[]>(
    expensesRequested ? `${session.flatId}-expenses` : `${session.flatId}-expenses-idle`,
    expensesRequested
      ? (onValue, onError) => subscribeExpenses(db, session.flatId, onValue, onError)
      : () => () => {},
    [],
  )
  const { t, locale } = useTranslation()
  // Where the person is lives in the history of the browser, so its back button goes back to the
  // previous section or closes the view that was opened.
  const [navigation] = useState(() =>
    // After a reload the section comes back, but not a form or a dialog that was open
    createNavigationStore(session.flatId, HOME, isPlace, takeRestore(), (place) => ({
      ...place,
      layer: null,
    })),
  )
  const place = useSyncExternalStore(navigation.subscribe, navigation.getSnapshot)
  const { tab, editing } = place
  const today = toIsoDate(now)
  const [renamingHeader, setRenamingHeader] = useState(false)
  // The editor of people and zones replaces the button that opens it: when it closes, the cursor goes back to
  // that button, so a keyboard or a screen reader does not lose its place
  const editorOpenedFromButton = useRef(false)
  const focusEditButton = (element: HTMLButtonElement | null) => {
    if (element && editorOpenedFromButton.current) {
      editorOpenedFromButton.current = false
      element.focus()
    }
  }
  // Where the menu to switch home opens from (null = closed)
  const [switcher, setSwitcher] = useState<HTMLElement | null>(null)
  const [draftName, setDraftName] = useState(flat.name)
  useEffect(() => {
    setRenamingHeader(false)
  }, [tab])
  // Auto-close: the first member to open the app on or after the close date triggers the write.
  // The transaction inside onClosePeriod ensures only one write happens even if two members open at once.
  useEffect(() => {
    const { periodClose } = flat
    if (periodClose && today >= periodClose.nextCloseDate) {
      const next = addMonths(periodClose.nextCloseDate, periodClose.intervalMonths)
      void onClosePeriod(next)
    }
    // Deliberately only on mount: we don't want to re-trigger if the flat doc updates mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const showPeriodBanner =
    flat.periodClose !== undefined &&
    today < flat.periodClose.nextCloseDate &&
    isWithinDays(today, flat.periodClose.nextCloseDate, 7)
  useEffect(() => {
    if (tab === 'expenses' && !expensesRequested) setExpensesRequested(true)
  }, [tab, expensesRequested])
  const online = useOnline()
  // The forms and dialogs that open on top of a screen are places too, so the back button closes them.
  // Opening one while another is open replaces it, and closing one that is not the open one does nothing.
  // A step of the layer that is open (its base is the same) is a new place; another layer replaces it.
  const openLayer = (layer: string) => {
    const now = navigation.getSnapshot()
    if (now.layer === null || layerBase(now.layer) === layerBase(layer)) {
      navigation.go({ ...now, layer })
    } else navigation.replace({ ...now, layer })
  }
  // Closing leaves every step of the layer at once
  const closeLayer = (layer: string) => {
    const now = navigation.getSnapshot()
    if (now.layer !== null && layerBase(now.layer) === layerBase(layer)) {
      navigation.closeMany(layerDepth(now.layer) + 1, { ...now, layer: null })
    }
  }
  const backLayer = (layer: string) => {
    const now = navigation.getSnapshot()
    if (
      now.layer !== null &&
      layerBase(now.layer) === layerBase(layer) &&
      layerDepth(now.layer) > 0
    ) {
      navigation.closeMany(1, {
        ...now,
        layer: withDepth(layerBase(now.layer) as string, layerDepth(now.layer) - 1),
      })
    }
  }
  const [problems, setProblems] = useState<string[]>([])
  const [renameProblems, setRenameProblems] = useState<string[]>([])
  const names = new Map(members.map((member) => [member.id, member.name]))
  const weekIndex = getWeekIndex(new Date(`${flat.startDate}T00:00:00`), now)
  // A flat that never edited its rotation has a single implicit layout: its people and zones
  const effective = layouts.length > 0 ? layouts : [baseLayout(members, flat.zones)]
  // Each week is read with the layout that was in force then
  const layout = layoutForWeek(effective, weekIndex)
  // The rotation with the zones that flatmates took from each other applied
  const rawAssignments = layout
    ? applyTakeovers(getAssignments(layout.members, layout.zones, weekIndex), takeovers, weekIndex)
    : []
  const assignments = rawAssignments.map(({ zone, member }) => ({
    zone,
    member: names.get(member) ?? '?',
  }))
  const takenFrom = Object.fromEntries(
    takeovers
      .filter((item) => item.weekIndex === weekIndex)
      .map((item) => [
        item.zone,
        {
          name: names.get(item.fromId) ?? '?',
          startsOn: weekStartDate(flat.startDate, item.debtWeek),
        },
      ]),
  )
  // What the person was told they do not have to clean: the running week and the ones that come
  const notices: TakeoverNotice[] = takeovers
    .filter((item) => item.fromId === session.memberId && item.weekIndex >= weekIndex)
    .sort((a, b) => a.weekIndex - b.weekIndex)
    .map((item) => ({
      zone: item.zone,
      startsOn: weekStartDate(flat.startDate, item.weekIndex),
      takerName: names.get(item.takerId) ?? '?',
      current: item.weekIndex === weekIndex,
    }))
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
    settlements,
    takeovers,
    currentWeek: weekIndex,
    startDate: flat.startDate,
  })

  // The cleanings of flatmates that this person can take to make up a zone they missed
  const takeable = takeableCleanings({
    layouts: effective,
    completions,
    takeovers,
    currentWeek: weekIndex,
    memberId: session.memberId,
  })

  // A zone made up with a cleaning is written with it: the screen builds both from the choice
  const settleZone = (input: SettleInput & { weekIndex: number; zone: string }) => {
    const taken = takeable.find(
      (item) => item.weekIndex === input.tookWeek && item.zone === input.tookZone,
    )
    if (input.kind !== 'madeUp' || !taken || input.tookWeek === undefined || !input.tookZone) {
      return onSettle(input)
    }
    return onMakeUp({
      takeover: {
        weekIndex: taken.weekIndex,
        zone: taken.zone,
        takerId: session.memberId,
        fromId: taken.fromId,
        debtWeek: input.weekIndex,
        debtZone: input.zone,
      },
      settlement: { ...input, memberId: session.memberId },
    })
  }

  // Undoing a zone that was made up takes back the cleaning as well
  const undoSettlement = (week: number, zone: string) => {
    const settlement = settlements.find((item) => item.weekIndex === week && item.zone === zone)
    const takeover = takeovers.find(
      (item) => item.weekIndex === settlement?.tookWeek && item.zone === settlement?.tookZone,
    )
    if (settlement?.kind === 'madeUp' && takeover) onUndoMakeUp({ takeover, settlement })
    else onUndoSettlement(week, zone)
  }

  // How the mascot feels: it follows the week and the zones left undone in finished weeks
  const { mine, others } = missedCounts(history, weekIndex, session.memberId)
  // Zones of the week in progress that still belong to the person looking at the screen
  const mineThisWeek = rawAssignments.filter(
    ({ zone, member }) => member === session.memberId && !findCompletion(done, weekIndex, zone),
  ).length

  // The zones the current person has next week (none if they rest or the layout is not defined yet)
  const nextLayout = layoutForWeek(effective, weekIndex + 1)
  const myNextZones = nextLayout
    ? applyTakeovers(
        getAssignments(nextLayout.members, nextLayout.zones, weekIndex + 1),
        takeovers,
        weekIndex + 1,
      )
        .filter(({ member }) => member === session.memberId)
        .map(({ zone }) => zone)
    : []
  // The person rests when the zones of the week are all of others (more people than zones)
  const iRest =
    rawAssignments.length > 0 && !rawAssignments.some(({ member }) => member === session.memberId)
  // What the person has in each of the next three weeks: when is their turn
  const upcoming = [1, 2, 3].map((ahead) => {
    const week = weekIndex + ahead
    const layout = layoutForWeek(effective, week)
    return {
      startsOn: weekStartDate(flat.startDate, week),
      endsOn: weekEndDate(flat.startDate, week),
      zones: layout
        ? applyTakeovers(getAssignments(layout.members, layout.zones, week), takeovers, week)
            .filter(({ member }) => member === session.memberId)
            .map(({ zone }) => zone)
        : [],
    }
  })
  const dayInWeek = getDayInWeek(new Date(`${flat.startDate}T00:00:00`), now)
  const mood = getMascotMood({
    done: assignments.filter((entry) => findCompletion(done, weekIndex, entry.zone)).length,
    total: assignments.length,
    dayInWeek,
    mine,
    others,
    mineThisWeek,
  })
  // Party, worry and anger each get a line; the two anger cases are told apart
  const speechCase =
    mood === 'party'
      ? 'party'
      : mood === 'worried'
        ? 'worried'
        : mood === 'angry'
          ? mine > 0
            ? 'angryDebts'
            : 'angryWeek'
          : undefined
  // The line changes day by day. The debts are told by number, and the bubble takes to them
  const mascotLineKey = pickMascotLine({
    speechCase,
    resting: iRest,
    debts: mine,
    seed: weekIndex * 7 + dayInWeek,
  })
  const mascotBubble = mascotLineKey ? t(mascotLineKey, { n: mine }) : undefined

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
    if (await onSaveRotation(result.plan)) navigation.close({ ...place, editing: false })
  }

  const submitRename = async (name: string): Promise<boolean> => {
    const found = validateFlatName(name)
    setRenameProblems(found)
    return found.length === 0 ? onRenameFlat(name, flat.inviteCode) : false
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

  const onAddExpense = (draft: ExpenseDraft) =>
    expenseAction.run(async () => {
      await saveExpense(db, session.flatId, {
        kind: 'expense',
        ...draft,
        createdBy: session.memberId,
      })
    })
  const onEditExpense = (expense: Expense, draft: ExpenseDraft) =>
    expenseAction.run(() => updateExpense(db, session.flatId, { ...expense, ...draft }))
  const onPayExpense = (payment: Payment) =>
    expenseAction.run(async () => {
      await saveExpense(db, session.flatId, {
        kind: 'payment',
        // A payment is shown with its own label, so the stored title is only there to satisfy the
        // rules: an empty one would make the write fail, and the other phone would never see it
        title: 'Payment',
        paidBy: payment.from,
        participants: [payment.to],
        amountCents: payment.amountCents,
        date: toIsoDate(now),
        createdBy: session.memberId,
      })
    })
  const onDeleteExpense = (expenseId: string) => {
    void expenseAction.run(() => deleteExpense(db, session.flatId, expenseId))
  }

  return (
    <>
      <Stack spacing={2} sx={{ pb: 12 }}>
        <Box>
          {isOwner && renamingHeader ? (
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <TextField
                  size="small"
                  label={t('create.flatName')}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  autoFocus
                  sx={{ flexGrow: 1 }}
                />
                <Button onClick={() => setRenamingHeader(false)}>{t('common.cancel')}</Button>
                <Button
                  variant="contained"
                  disabled={renameBusy}
                  onClick={async () => {
                    if (await submitRename(draftName)) setRenamingHeader(false)
                  }}
                >
                  {renameBusy ? t('common.saving') : t('common.save')}
                </Button>
              </Stack>
              {renameProblems.length > 0 ? (
                <Alert severity="error">
                  {renameProblems.map((code) => (
                    <div key={code}>{code}</div>
                  ))}
                </Alert>
              ) : null}
              {renameError ? <Alert severity="error">{renameError}</Alert> : null}
            </Stack>
          ) : (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              {/* A long name wraps instead of pushing the buttons beside it out of the screen */}
              <Typography
                variant="h5"
                component="h1"
                sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
              >
                {flat.name}
              </Typography>
              {/* The name opens the menu to switch home, create another or join one */}
              <IconButton
                size="small"
                aria-label={t('flats.myHomes')}
                aria-haspopup="menu"
                aria-expanded={switcher !== null}
                sx={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET }}
                onClick={(event) => {
                  setSwitcher(event.currentTarget)
                  onOpenSwitcher()
                }}
              >
                <ChevronDownIcon />
              </IconButton>
              <Menu open={switcher !== null} anchorEl={switcher} onClose={() => setSwitcher(null)}>
                {savedFlats.map((saved) => (
                  <MenuItem
                    key={saved.flatId}
                    selected={saved.flatId === flat.id}
                    aria-current={saved.flatId === flat.id ? 'true' : undefined}
                    onClick={() => {
                      setSwitcher(null)
                      if (saved.flatId !== flat.id) onSwitchFlat(saved.flatId)
                    }}
                  >
                    <ListItemText>{saved.name || t('flats.unnamed')}</ListItemText>
                    {saved.flatId === flat.id ? (
                      <CheckIcon fontSize="small" sx={{ ml: 2 }} />
                    ) : null}
                  </MenuItem>
                ))}
                <Divider />
                <MenuItem
                  onClick={() => {
                    setSwitcher(null)
                    onChangeFlat('create')
                  }}
                >
                  {t('welcome.create')}
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setSwitcher(null)
                    onChangeFlat('join')
                  }}
                >
                  {t('welcome.join')}
                </MenuItem>
              </Menu>
              {isOwner ? (
                <IconButton
                  size="small"
                  aria-label={t('flatSettings.rename')}
                  sx={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET }}
                  onClick={() => {
                    setDraftName(flat.name)
                    setRenamingHeader(true)
                  }}
                >
                  <EditIcon sx={{ fontSize: 18 }} />
                </IconButton>
              ) : null}
            </Stack>
          )}
          {tab === 'week' ? (
            <Typography color="text.secondary">
              {t('week.title', {
                start: formatDay(weekStartDate(flat.startDate, weekIndex), locale),
                end: formatDay(weekEndDate(flat.startDate, weekIndex), locale),
              })}
            </Typography>
          ) : null}
        </Box>
        <OfflineNotice offline={!online} />
        {/* key={tab} unmounts and remounts the m.div, triggering the animation on every tab switch */}
        <m.div
          key={tab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          <Stack spacing={2}>
            {tab === 'week' ? (
              <>
                {saveError ? <Alert severity="error">{saveError}</Alert> : null}
                {showPeriodBanner && flat.periodClose ? (
                  <ExpensePeriodBanner
                    closeDate={flat.periodClose.nextCloseDate}
                    onSettleExpenses={() => navigation.go({ ...place, tab: 'expenses' })}
                  />
                ) : null}
                <TakeoverNotices notices={notices} />
                <ThisWeek
                  weekIndex={weekIndex}
                  startsOn={weekStartDate(flat.startDate, weekIndex)}
                  assignments={assignments}
                  completions={done}
                  currentMember={names.get(session.memberId) ?? ''}
                  colors={Object.fromEntries(members.map((member) => [member.name, member.color]))}
                  today={toIsoDate(now)}
                  mood={iRest && mine === 0 ? 'sleepy' : mood}
                  resting={iRest}
                  upcoming={upcoming}
                  mascotBubble={mascotBubble}
                  onMascotBubble={
                    speechCase === 'angryDebts'
                      ? () => navigation.go({ ...place, tab: 'history', layer: null })
                      : undefined
                  }
                  takenFrom={takenFrom}
                  nextZones={myNextZones}
                  onMarkDone={markDone}
                  onUndoDone={onUndoDone}
                  layer={place.layer}
                  onOpenLayer={openLayer}
                  onCloseLayer={closeLayer}
                  onBackLayer={backLayer}
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
                colors={Object.fromEntries(members.map((member) => [member.id, member.color]))}
                currentWeek={weekIndex}
                weekStart={(index) => weekStartDate(flat.startDate, index)}
                people={personStats(history, weekIndex)}
                zones={zoneStats(history, weekIndex)}
                // The cleanings that were settled with a date show on their day, like the ones that were marked
                calendarCompletions={[...completions, ...settledCleanings(history)]}
                today={toIsoDate(now)}
                settle={{
                  takeable: takeable.map((item) => ({
                    ...item,
                    startsOn: weekStartDate(flat.startDate, item.weekIndex),
                  })),
                  currentMemberId: session.memberId,
                  isOwner,
                  busy: settleBusy,
                  error: settleError,
                  onSettle: settleZone,
                  onUndo: undoSettlement,
                }}
                layer={place.layer}
                onOpenLayer={openLayer}
                onCloseLayer={closeLayer}
                onBackLayer={backLayer}
              />
            ) : tab === 'settings' ? (
              <SettingsView
                isGoogle={isGoogle}
                accountEmail={accountEmail}
                linkBusy={linkBusy}
                linkError={linkError}
                version={APP_VERSION}
                logOutBusy={logOutBusy}
                logOutError={logOutError}
                onLinkGoogle={onLinkGoogle}
                onLogOut={onLogOut}
                isOwner={isOwner}
                flatName={flat.name}
                online={online}
                onDeleteFlat={onDeleteFlat}
                onChangeFlat={() => onChangeFlat()}
              />
            ) : tab === 'expenses' ? (
              <ExpensesView
                expenses={expenses.value}
                people={members
                  .filter((member) => member.active)
                  .sort((a, b) => a.order - b.order)
                  .map((member) => ({ id: member.id, name: member.name, color: member.color }))}
                currentMemberId={session.memberId}
                today={toIsoDate(now)}
                busy={expenseAction.busy}
                error={expenseAction.error}
                periodCloseDate={showPeriodBanner ? flat.periodClose?.nextCloseDate : undefined}
                flatName={flat.name}
                onAdd={onAddExpense}
                onEdit={onEditExpense}
                onPay={onPayExpense}
                onDelete={onDeleteExpense}
                layer={place.layer}
                onOpenLayer={openLayer}
                onCloseLayer={closeLayer}
                onBackLayer={backLayer}
                footer={
                  <TricountLink
                    url={flat.tricountUrl}
                    canEdit={isOwner}
                    busy={tricountBusy}
                    error={tricountError}
                    onSave={onSaveTricount}
                  />
                }
              />
            ) : tab === 'members' && isOwner && editing ? (
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
                  navigation.close({ ...place, editing: false })
                }}
              />
            ) : tab === 'members' ? (
              <>
                <MembersList
                  members={members
                    .filter((member) => member.active)
                    .map((member) => ({
                      id: member.id,
                      name: member.name,
                      claimed: member.uid !== null,
                      color: member.color,
                      isCreator: member.uid !== null && member.uid === flat.ownerUid,
                      uid: member.uid ?? undefined,
                      hasGoogle: member.hasGoogle === true,
                    }))}
                  currentMemberId={session.memberId}
                  canManage={isOwner}
                  busy={releaseBusy}
                  error={releaseError}
                  colorBusy={colorBusy}
                  onRelease={onRelease}
                  handOverBusy={handOverBusy}
                  handOverError={handOverError}
                  onHandOver={(newOwnerUid) => onHandOver(newOwnerUid, flat.inviteCode)}
                  onChangeColor={onChangeColor}
                />
                <InviteCode code={flat.inviteCode} appUrl={window.location.origin} />
                {isOwner ? (
                  <>
                    <m.div
                      whileTap={{ scale: 0.97 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    >
                      <Button
                        ref={focusEditButton}
                        variant="contained"
                        fullWidth
                        startIcon={<EditIcon />}
                        onClick={() => {
                          editorOpenedFromButton.current = true
                          navigation.go({ ...place, editing: true })
                        }}
                      >
                        {t('rotation.edit')}
                      </Button>
                    </m.div>
                  </>
                ) : null}
              </>
            ) : null}
          </Stack>
        </m.div>
      </Stack>
      <BottomTabs
        value={tab}
        historyCount={mine}
        onChange={(next) => {
          // Leaving the section: the cursor is not owed to the button any more
          editorOpenedFromButton.current = false
          navigation.go({ tab: next, editing: false, layer: null })
        }}
      />
    </>
  )
}
