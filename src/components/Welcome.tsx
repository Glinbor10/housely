import { Button, Stack, Typography } from '@mui/material'

interface WelcomeProps {
  onCreate: () => void
  onJoin: () => void
}

export const Welcome = ({ onCreate, onJoin }: WelcomeProps) => (
  <Stack spacing={3}>
    <Typography variant="h4">Housely</Typography>
    <Typography color="text.secondary">
      Share the chores of your flat: every week each person gets a zone and the rotation does the
      rest.
    </Typography>
    <Button variant="contained" size="large" onClick={onCreate}>
      Create a flat
    </Button>
    <Button variant="outlined" size="large" onClick={onJoin}>
      Join a flat
    </Button>
  </Stack>
)
