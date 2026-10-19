import { useState } from 'react'
import { Container, Stack } from '@mui/material'
import { InstallHint } from './components/InstallHint'
import { shouldSuggestInstall } from './pwa/installHint'
import { AuthGate } from './screens/AuthGate'
import { readInstallContext } from './screens/installContext'
import { FlatScreen } from './screens/FlatScreen'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { dismissInstallHint, isInstallHintDismissed } from './storage/preferences'
import { clearSession, getBrowserStorage, loadSession, type Session } from './storage/session'

const Home = ({ uid }: { uid: string }) => {
  // The flat of this device is remembered, so the app opens on it next time
  const [session, setSession] = useState<Session | null>(() => loadSession(getBrowserStorage()))

  const [hintDismissed, setHintDismissed] = useState(() =>
    isInstallHintDismissed(getBrowserStorage()),
  )
  const showHint = shouldSuggestInstall(readInstallContext(hintDismissed))

  const content = session ? (
    <FlatScreen
      uid={uid}
      session={session}
      onLeave={() => {
        clearSession(getBrowserStorage())
        setSession(null)
      }}
    />
  ) : (
    <OnboardingScreen uid={uid} onDone={setSession} />
  )

  return (
    <Stack spacing={2}>
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
