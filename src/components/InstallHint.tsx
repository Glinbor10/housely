import { Alert, Button } from '@mui/material'

interface InstallHintProps {
  onDismiss: () => void
}

export const InstallHint = ({ onDismiss }: InstallHintProps) => (
  <Alert
    severity="info"
    action={
      <Button color="inherit" onClick={onDismiss}>
        Got it
      </Button>
    }
  >
    Install Housely: tap Share, then Add to Home Screen. Otherwise Safari may delete your data after
    a week without opening it and you could lose your access to the flat.
  </Alert>
)
