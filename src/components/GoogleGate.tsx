import { Alert, Button, Stack, Typography } from '@mui/material'

interface GoogleGateProps {
  busy: boolean
  error: string | null
  onContinue: () => void
  onBack: () => void
}

export const GoogleGate = ({ busy, error, onContinue, onBack }: GoogleGateProps) => (
  <Stack spacing={3}>
    <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
      Create your flat with Google
    </Typography>
    <Stack spacing={1.5}>
      <Typography>
        Your flat stays yours: with your Google account you can find it again from any phone, even
        if you lose this one.
      </Typography>
      <Typography color="text.secondary">
        Flatmates do not need Google: they join with the invite code and can link their account
        later if they want.
      </Typography>
    </Stack>
    {error ? <Alert severity="error">{error}</Alert> : null}
    <Stack direction="row" spacing={1}>
      <Button onClick={onBack}>Back</Button>
      <Button variant="contained" size="large" disabled={busy} onClick={onContinue}>
        {busy ? 'Opening Google...' : 'Continue with Google'}
      </Button>
    </Stack>
  </Stack>
)
