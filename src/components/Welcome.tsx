import { Box, Button, Stack, Typography } from '@mui/material'

interface WelcomeProps {
  onCreate: () => void
  onJoin: () => void
  onSignIn: () => void
}

export const Welcome = ({ onCreate, onJoin, onSignIn }: WelcomeProps) => (
  <Stack spacing={3} sx={{ alignItems: 'center', textAlign: 'center', pt: 4 }}>
    <Box
      component="img"
      src="/logo.svg"
      alt="Housely logo"
      sx={{ width: 112, height: 112, borderRadius: 4, boxShadow: 3 }}
    />
    <Stack spacing={1}>
      <Typography variant="h3" component="h1" sx={{ fontWeight: 700 }}>
        Housely
      </Typography>
      <Typography color="text.secondary">
        Share the chores of your flat: every week each person gets a zone and the rotation does the
        rest.
      </Typography>
    </Stack>
    <Stack spacing={2} sx={{ width: '100%' }}>
      <Button variant="contained" size="large" onClick={onCreate}>
        Create a flat
      </Button>
      <Button variant="outlined" size="large" onClick={onJoin}>
        Join a flat
      </Button>
      <Button onClick={onSignIn}>I already have a flat</Button>
    </Stack>
  </Stack>
)
