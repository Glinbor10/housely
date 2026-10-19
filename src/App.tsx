import { useState } from 'react'
import { Container } from '@mui/material'
import { AuthGate } from './screens/AuthGate'
import { FlatScreen } from './screens/FlatScreen'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { clearSession, getBrowserStorage, loadSession, type Session } from './storage/session'

const Home = ({ uid }: { uid: string }) => {
  // The flat of this device is remembered, so the app opens on it next time
  const [session, setSession] = useState<Session | null>(() => loadSession(getBrowserStorage()))

  return session ? (
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
}

const App = () => (
  <Container maxWidth="sm" sx={{ py: 3 }}>
    <AuthGate>{(uid) => <Home uid={uid} />}</AuthGate>
  </Container>
)

export default App
