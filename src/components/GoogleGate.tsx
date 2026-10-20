import { Alert, Button, Stack, Typography } from '@mui/material'
import { useTranslation } from '../i18n/useTranslation'

interface GoogleGateProps {
  busy: boolean
  error: string | null
  onContinue: () => void
  onBack: () => void
}

export const GoogleGate = ({ busy, error, onContinue, onBack }: GoogleGateProps) => {
  const { t } = useTranslation()
  return (
    <Stack spacing={3}>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
        {t('google.title')}
      </Typography>
      <Stack spacing={1.5}>
        <Typography>{t('google.why')}</Typography>
        <Typography color="text.secondary">{t('google.flatmates')}</Typography>
      </Stack>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Stack direction="row" spacing={1}>
        <Button onClick={onBack}>{t('common.back')}</Button>
        <Button variant="contained" size="large" disabled={busy} onClick={onContinue}>
          {busy ? t('google.opening') : t('google.continue')}
        </Button>
      </Stack>
    </Stack>
  )
}
