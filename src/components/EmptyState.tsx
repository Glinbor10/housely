import { Stack, Typography } from '@mui/material'
import type { Mood } from '../domain/mood'
import { Mascot } from './Mascot'

interface EmptyStateProps {
  mood?: Mood
  // What is missing and what the person can do about it
  text: string
}

// A screen with nothing to show yet: the mascot and one sentence that says what to do, not just that
// it is empty.
export const EmptyState = ({ mood = 'sleepy', text }: EmptyStateProps) => (
  <Stack spacing={1} sx={{ alignItems: 'center', textAlign: 'center', py: 3 }}>
    <Mascot mood={mood} size={96} decorative />
    <Typography color="text.secondary" sx={{ maxWidth: 'sm' }}>
      {text}
    </Typography>
  </Stack>
)
