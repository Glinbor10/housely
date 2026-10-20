import { Alert, Button } from '@mui/material'
import { useTranslation } from '../i18n/useTranslation'

interface InstallHintProps {
  onDismiss: () => void
}

export const InstallHint = ({ onDismiss }: InstallHintProps) => {
  const { t } = useTranslation()
  return (
    <Alert
      severity="info"
      action={
        <Button color="inherit" onClick={onDismiss}>
          {t('install.gotIt')}
        </Button>
      }
    >
      {t('install.text')}
    </Alert>
  )
}
