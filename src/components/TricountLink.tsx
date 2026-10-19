import { useState } from 'react'
import { Alert, Button, Stack, TextField, Typography } from '@mui/material'
import { parseTricountUrl } from '../domain/tricount'

interface TricountLinkProps {
  url: string | undefined
  // Only the owner of the flat can change the link (enforced by the Firestore rules too)
  canEdit: boolean
  busy: boolean
  error: string | null
  onSave: (url: string | null) => void
}

const REASONS = {
  'not-https': 'The link must start with https://',
  'not-tricount': 'Only links on tricount.com are allowed.',
  'too-long': 'The link is too long (300 characters at most).',
} as const

export const TricountLink = ({ url, canEdit, busy, error, onSave }: TricountLinkProps) => {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(url ?? '')
  const [problem, setProblem] = useState<string | null>(null)

  const save = () => {
    const parsed = parseTricountUrl(value)
    if (parsed.ok) {
      setProblem(null)
      onSave(parsed.url)
    } else {
      setProblem(REASONS[parsed.reason])
    }
  }

  return (
    <Stack spacing={1}>
      {url ? (
        <Button
          variant="outlined"
          component="a"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Tricount
        </Button>
      ) : (
        <Typography color="text.secondary">
          The owner has not added the Tricount link yet.
        </Typography>
      )}

      {canEdit && !editing ? (
        <Button size="small" onClick={() => setEditing(true)}>
          {url ? 'Edit Tricount link' : 'Add Tricount link'}
        </Button>
      ) : null}

      {canEdit && editing ? (
        <Stack spacing={1}>
          <TextField
            size="small"
            label="Tricount link"
            helperText="Leave it empty to remove the link."
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          {problem ? <Alert severity="error">{problem}</Alert> : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Stack direction="row" spacing={1}>
            <Button onClick={() => setEditing(false)}>Cancel</Button>
            <Button variant="contained" disabled={busy} onClick={save}>
              {busy ? 'Saving...' : 'Save'}
            </Button>
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  )
}
