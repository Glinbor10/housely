import { Suspense, use, type ReactNode } from 'react'
import { Alert, CircularProgress, Stack } from '@mui/material'
import { getAuthResult } from './authResult'

interface AuthGateProps {
  children: (uid: string) => ReactNode
}

const Resolved = ({ children }: AuthGateProps) => {
  const result = use(getAuthResult())
  return result.uid !== undefined ? (
    children(result.uid)
  ) : (
    <Alert severity="error">
      Could not sign in. Check your connection and reload the page. ({result.error.message})
    </Alert>
  )
}

export const AuthGate = ({ children }: AuthGateProps) => (
  <Suspense
    fallback={
      <Stack sx={{ alignItems: 'center', py: 6 }}>
        <CircularProgress aria-label="Loading" />
      </Stack>
    }
  >
    <Resolved>{children}</Resolved>
  </Suspense>
)
