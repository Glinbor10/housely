import { useState } from 'react'
import { Alert, Button, Stack, Typography } from '@mui/material'

interface InviteCodeProps {
  code: string
  // The address of the app, sent together with the code so flatmates can open it
  appUrl: string
}

type Outcome = 'idle' | 'copied' | 'manual'

export const InviteCode = ({ code, appUrl }: InviteCodeProps) => {
  const [outcome, setOutcome] = useState<Outcome>('idle')
  const message = `Join our flat on Housely with the code ${code}: ${appUrl}`

  // The share sheet of the phone (WhatsApp, Messages...) when there is one, otherwise the clipboard.
  const share = async () => {
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Housely', text: message, url: appUrl })
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(message)
        setOutcome('copied')
      } else {
        setOutcome('manual')
      }
    } catch (error) {
      // Closing the share sheet is not an error
      if (!(error instanceof DOMException && error.name === 'AbortError')) setOutcome('manual')
    }
  }

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography color="text.secondary">
          Invite code{' '}
          <Typography
            component="strong"
            sx={{
              fontFamily: 'monospace',
              fontSize: '1.2em',
              letterSpacing: 2,
              color: 'text.primary',
            }}
          >
            {code}
          </Typography>
        </Typography>
        <Button size="small" variant="outlined" aria-label="Share the code" onClick={share}>
          Share
        </Button>
      </Stack>
      {outcome === 'copied' ? (
        <Alert severity="success">Copied: paste it in your chat.</Alert>
      ) : null}
      {outcome === 'manual' ? (
        <Alert severity="info">Could not share from here: send it by hand. {message}</Alert>
      ) : null}
    </Stack>
  )
}
