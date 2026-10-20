import { Alert, Button, Stack } from '@mui/material'

interface SaveAccessBannerProps {
  busy: boolean
  error: string | null
  onSave: () => void
  onDismiss: () => void
}

export const SaveAccessBanner = ({ busy, error, onSave, onDismiss }: SaveAccessBannerProps) => (
  <Stack spacing={1}>
    <Alert
      severity="info"
      action={
        <Stack direction="row" spacing={1}>
          <Button color="inherit" onClick={onDismiss}>
            Not now
          </Button>
          <Button color="inherit" disabled={busy} onClick={onSave}>
            {busy ? 'Linking...' : 'Link Google'}
          </Button>
        </Stack>
      }
    >
      Save your access: link your Google account (optional) so you can get back to this flat from
      another phone.
    </Alert>
    {error ? <Alert severity="error">{error}</Alert> : null}
  </Stack>
)
