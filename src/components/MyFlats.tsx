import { Alert, Button, CircularProgress, Stack, Typography } from '@mui/material'

export interface FlatChoice {
  flatId: string
  memberId: string
  flatName: string
}

interface MyFlatsProps {
  // Null while the flats of the account are being loaded
  flats: FlatChoice[] | null
  busy: boolean
  error: string | null
  onOpen: (flat: FlatChoice) => void
  onBack: () => void
}

export const MyFlats = ({ flats, busy, error, onOpen, onBack }: MyFlatsProps) => (
  <Stack spacing={3}>
    <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
      Your flats
    </Typography>

    {flats === null && !error ? (
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <CircularProgress size={24} aria-label="Loading" />
        <Typography>Looking for your flats...</Typography>
      </Stack>
    ) : null}

    {flats !== null && flats.length === 0 ? (
      <Alert severity="info">
        We did not find any flat for this Google account. If you were invited to one, go back and
        join with the invite code.
      </Alert>
    ) : null}

    {flats !== null && flats.length > 0 ? (
      <Stack spacing={1}>
        {flats.map((flat) => (
          <Button
            key={flat.flatId}
            variant="outlined"
            size="large"
            disabled={busy}
            onClick={() => onOpen(flat)}
          >
            {flat.flatName}
          </Button>
        ))}
      </Stack>
    ) : null}

    {error ? <Alert severity="error">{error}</Alert> : null}
    <Button onClick={onBack}>Back</Button>
  </Stack>
)
