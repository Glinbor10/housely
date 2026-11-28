import { useRef, useState, useSyncExternalStore } from 'react'
import { Alert, Box, Container, Stack } from '@mui/material'
import { InstallHint } from './components/InstallHint'
import { LanguageSwitch } from './components/LanguageSwitch'
import { getFirebase } from './firebase/app'
import { isGoogleUser, type AuthUserInfo } from './firebase/googleAccess'
import { subscribeAuthUser } from './firebase/googleSignIn'
import { useAuthUser } from './hooks/useAuthUser'
import { listMyFlats, type MyFlat } from './firebase/flatRepository'
import { leaveTickets, claimTickets, type PendingTransfer } from './firebase/transfer'
import { accountNotice } from './hooks/accountNoticeStore'
import { useTranslation } from './i18n/useTranslation'
import { shouldSuggestInstall } from './pwa/installHint'
import { AuthGate } from './screens/AuthGate'
import { readInstallContext } from './screens/installContext'
import { FlatScreen } from './screens/FlatScreen'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { dismissInstallHint, isInstallHintDismissed } from './storage/preferences'
import {
  activateFlat,
  activeFlat,
  addFlat,
  adoptAccountFlats,
  getBrowserStorage,
  loadBook,
  removeFlat,
  renameFlat,
  saveBook,
  type FlatBook,
} from './storage/session'

// A stable function: it identifies the subscription of the live account
const subscribeToAccount = (onChange: (user: AuthUserInfo | null) => void) =>
  subscribeAuthUser(getFirebase().auth, onChange)

// Where the start screen opens when switching homes
type StartAt = 'welcome' | 'create' | 'join'

const Home = ({ uid }: { uid: string }) => {
  // The account is live: it changes when an anonymous identity is linked to Google or switched to an
  // existing Google account. Until the first update, the identity that signed in is used.
  const user = useAuthUser(subscribeToAccount) ?? { uid, isAnonymous: true, providerIds: [] }

  // The flats of this device are remembered, so the app opens on the one that was open
  const [book, setBook] = useState<FlatBook>(() => loadBook(getBrowserStorage()))
  // Changing home opens the start screen (or the form to create or join) and keeps the homes that are already here
  const [changing, setChanging] = useState<StartAt | null>(null)
  // Every change goes through the previous book, so a late event never overwrites a newer one
  const updateBook = (change: (previous: FlatBook) => FlatBook) =>
    setBook((previous) => {
      const next = change(previous)
      if (next !== previous) saveBook(getBrowserStorage(), next)
      return next
    })
  const active = activeFlat(book)

  // A person with Google has every home of the account at hand, without signing in again: they are
  // added to the ones of this device when they switch
  const refreshFlats = async () => {
    if (!isGoogleUser(user)) return
    try {
      const mine = await listMyFlats(getFirebase().db, user.uid)
      updateBook((previous) =>
        mine.reduce(
          (book, flat) =>
            addFlat(
              book,
              { flatId: flat.flatId, memberId: flat.memberId, name: flat.flatName },
              { open: false },
            ),
          previous,
        ),
      )
    } catch {
      // The homes of this device are still there
    }
  }
  // What happened to the homes of this device when the person signed in to an account that already
  // existed: the ones that came along and the ones that stayed behind, told once
  // Switching account changes the identity and the screens start again: the notice lives outside them
  const { broughtAlong, leftBehind, switches } = useSyncExternalStore(
    accountNotice.subscribe,
    accountNotice.getSnapshot,
  )
  const { t } = useTranslation()
  // The tickets left by the identity that is about to go, kept until the switch is done
  const pendingTransfers = useRef<PendingTransfer[]>([])
  const accountSwitch = {
    before: async () => {
      pendingTransfers.current = await leaveTickets(getFirebase().db, user.uid, book.flats)
    },
    after: async (uid: string): Promise<MyFlat[]> => {
      const { db } = getFirebase()
      const { moved, failed } = await claimTickets(db, uid, pendingTransfers.current)
      pendingTransfers.current = []
      const mine = await listMyFlats(db, uid)
      const ids = mine.map((flat) => flat.flatId)
      // The screen that started this may be gone by now (the identity changed and the screens start
      // again), so the book is read from and written to the storage, not taken from a state
      const storage = getBrowserStorage()
      const stored = loadBook(storage)
      const next = adoptAccountFlats(stored, mine)
      saveBook(storage, next)
      setBook(next)
      // Came along: the moves that worked. Stayed behind: the ones that were refused, and the homes that
      // the account does not have at all
      const notMine = stored.flats.filter((flat) => !ids.includes(flat.flatId))
      accountNotice.set({
        broughtAlong: moved.map((flat) => flat.name),
        leftBehind: [...new Set([...failed, ...notMine].map((flat) => flat.name))],
      })
      return mine
    },
  }
  const startChanging = (at: StartAt = 'welcome') => {
    setChanging(at)
    void refreshFlats()
  }

  const [hintDismissed, setHintDismissed] = useState(() =>
    isInstallHintDismissed(getBrowserStorage()),
  )
  const showHint = shouldSuggestInstall(readInstallContext(hintDismissed))

  const content =
    active && changing === null ? (
      <FlatScreen
        key={`${active.flatId}-${switches}`}
        uid={user.uid}
        isGoogle={isGoogleUser(user)}
        accountEmail={user.email ?? null}
        session={active}
        savedFlats={book.flats}
        onSwitchFlat={(flatId) => updateBook((previous) => activateFlat(previous, flatId))}
        onOpenSwitcher={() => void refreshFlats()}
        onChangeFlat={startChanging}
        onFlatName={(name) => updateBook((previous) => renameFlat(previous, active.flatId, name))}
        onLeave={() => updateBook((previous) => removeFlat(previous, active.flatId))}
        accountSwitch={accountSwitch}
      />
    ) : (
      <OnboardingScreen
        user={user}
        onDone={(flat) => {
          updateBook((previous) => addFlat(previous, flat))
          setChanging(null)
        }}
        savedFlats={book.flats}
        currentFlatId={active?.flatId ?? null}
        onOpenSaved={(flatId) => {
          updateBook((previous) => activateFlat(previous, flatId))
          setChanging(null)
        }}
        initialView={changing ?? 'welcome'}
        onCancel={active ? () => setChanging(null) : undefined}
        accountSwitch={accountSwitch}
      />
    )

  return (
    <Stack spacing={2}>
      {/* Once a flat is open the language lives in its settings */}
      {active && changing === null ? null : (
        <Box sx={{ alignSelf: 'flex-end' }}>
          <LanguageSwitch />
        </Box>
      )}
      {showHint ? (
        <InstallHint
          onDismiss={() => {
            dismissInstallHint(getBrowserStorage())
            setHintDismissed(true)
          }}
        />
      ) : null}
      {broughtAlong.length > 0 ? (
        <Alert severity="success" onClose={() => accountNotice.dismiss('broughtAlong')}>
          {t('flats.broughtAlong', { names: broughtAlong.join(', ') })}
        </Alert>
      ) : null}
      {leftBehind.length > 0 ? (
        <Alert severity="info" onClose={() => accountNotice.dismiss('leftBehind')}>
          {t('flats.leftBehind', { names: leftBehind.join(', ') })}
        </Alert>
      ) : null}
      {content}
    </Stack>
  )
}

const App = () => (
  <Container
    maxWidth="sm"
    sx={{
      pt: 'max(24px, env(safe-area-inset-top))',
      pb: 'max(24px, env(safe-area-inset-bottom))',
    }}
  >
    <AuthGate>{(uid) => <Home uid={uid} />}</AuthGate>
  </Container>
)

export default App
