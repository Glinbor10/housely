import { Alert, Button, Stack } from '@mui/material'
import { useTranslation } from '../i18n/useTranslation'

interface SaveAccessBannerProps {
  busy: boolean
  error: string | null
  onSave: () => void
  onDismiss: () => void
}

export const SaveAccessBanner = ({ busy, error, onSave, onDismiss }: SaveAccessBannerProps) => {
  const { t } = useTranslation()
  return (
    <Stack spacing={1}>
      <Alert
        severity="info"
        action={
          <Stack direction="row" spacing={1}>
            <Button color="inherit" onClick={onDismiss}>
              {t('saveAccess.notNow')}
            </Button>
            <Button color="inherit" disabled={busy} onClick={onSave}>
              {busy ? t('saveAccess.linking') : t('saveAccess.link')}
            </Button>
          </Stack>
        }
      >
        {t('saveAccess.text')}
      </Alert>
      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  )
}
