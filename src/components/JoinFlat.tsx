import { useState } from 'react'
import { Alert, Button, Stack, TextField, Typography } from '@mui/material'

interface Candidate {
  id: string
  name: string
}

interface JoinFlatProps {
  // Null until the invite code has been resolved; then the names nobody has claimed yet
  candidates: Candidate[] | null
  busy: boolean
  error: string | null
  onFind: (code: string) => void
  onPick: (memberId: string) => void
  onBack: () => void
}

export const JoinFlat = ({ candidates, busy, error, onFind, onPick, onBack }: JoinFlatProps) => {
  const [code, setCode] = useState('')

  return (
    <Stack spacing={3}>
      <Typography variant="h5">Join a flat</Typography>

      {candidates === null ? (
        <>
          <Typography color="text.secondary">
            Ask a flatmate for the invite code of your flat.
          </Typography>
          <TextField
            label="Invite code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Stack direction="row" spacing={1}>
            <Button onClick={onBack}>Back</Button>
            <Button
              variant="contained"
              disabled={busy}
              onClick={() => (code.trim() ? onFind(code) : undefined)}
            >
              {busy ? 'Searching...' : 'Continue'}
            </Button>
          </Stack>
        </>
      ) : (
        <>
          <Typography>Who are you?</Typography>
          {candidates.length === 0 ? (
            <Alert severity="warning">
              Every person of this flat is already taken. Ask the creator to add you.
            </Alert>
          ) : (
            <Stack spacing={1}>
              {candidates.map((candidate) => (
                <Button
                  key={candidate.id}
                  variant="outlined"
                  disabled={busy}
                  onClick={() => onPick(candidate.id)}
                >
                  {candidate.name}
                </Button>
              ))}
            </Stack>
          )}
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Button onClick={onBack}>Back</Button>
        </>
      )}
    </Stack>
  )
}
