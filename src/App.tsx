import { useState } from 'react'
import { Box, Container, Stack } from '@mui/material'
import { InstallHint } from './components/InstallHint'
import { LanguageSwitch } from './components/LanguageSwitch'
import { getFirebase } from './firebase/app'
import { isGoogleUser, type AuthUserInfo } from './firebase/googleAccess'
import { subscribeAuthUser } from './firebase/googleSignIn'
import { useAuthUser } from './hooks/useAuthUser'
import { shouldSuggestInstall } from './pwa/installHint'
import { AuthGate } from './screens/AuthGate'
import { readInstallContext } from './screens/installContext'
import { FlatScreen } from './screens/FlatScreen'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { dismissInstallHint, isInstallHintDismissed } from './storage/preferences'
import { clearSession, getBrowserStorage, loadSession, type Session } from './storage/session'

// A stable function: it identifies the subscription of the live account
const subscribeToAccount = (onChange: (user: AuthUserInfo | null) => void) =>
  subscribeAuthUser(getFirebase().auth, onChange)

const Home = ({ uid }: { uid: string }) => {
  // The account is live: it changes when an anonymous identity is linked to Google or switched to an
  // existing Google account. Until the first update, the identity that signed in is used.
  const user = useAuthUser(subscribeToAccount) ?? { uid, isAnonymous: true, providerIds: [] }

  // The flat of this device is remembered, so the app opens on it next time
  const [session, setSession] = useState<Session | null>(() => loadSession(getBrowserStorage()))

  const [hintDismissed, setHintDismissed] = useState(() =>
    isInstallHintDismissed(getBrowserStorage()),
  )
  const showHint = shouldSuggestInstall(readInstallContext(hintDismissed))

  const content = session ? (
    <FlatScreen
      uid={user.uid}
      isGoogle={isGoogleUser(user)}
      accountEmail={user.email ?? null}
      session={session}
      onLeave={() => {
        clearSession(getBrowserStorage())
        setSession(null)
      }}
    />
  ) : (
    <OnboardingScreen user={user} onDone={setSession} />
  )

  return (
    <Stack spacing={2}>
      {/* Once a flat is open the language lives in its settings */}
      {session ? null : (
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
