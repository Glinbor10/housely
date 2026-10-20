import { Suspense, use, type ReactNode } from 'react'
import { Alert, CircularProgress, Stack } from '@mui/material'
import { useTranslation } from '../i18n/useTranslation'
import { getAuthResult } from './authResult'

interface AuthGateProps {
  children: (uid: string) => ReactNode
}

const Resolved = ({ children }: AuthGateProps) => {
  const { t } = useTranslation()
  const result = use(getAuthResult())
  return result.uid !== undefined ? (
    children(result.uid)
  ) : (
    <Alert severity="error">
      {t('auth.failed')} ({result.error.message})
    </Alert>
  )
}

const Loading = () => {
  const { t } = useTranslation()
  return (
    <Stack sx={{ alignItems: 'center', py: 6 }}>
      <CircularProgress aria-label={t('common.loading')} />
    </Stack>
  )
}

export const AuthGate = ({ children }: AuthGateProps) => (
  <Suspense fallback={<Loading />}>
    <Resolved>{children}</Resolved>
  </Suspense>
)
