import { useState } from 'react'
import { Alert, Button, Stack, Typography } from '@mui/material'
import { useTranslation } from '../i18n/useTranslation'

interface InviteCodeProps {
  code: string
  // The address of the app, sent together with the code so flatmates can open it
  appUrl: string
}

type Outcome = 'idle' | 'copied' | 'manual'

export const InviteCode = ({ code, appUrl }: InviteCodeProps) => {
  const { t } = useTranslation()
  const [outcome, setOutcome] = useState<Outcome>('idle')
  const message = t('invite.message', { code, url: appUrl })

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
          {t('invite.label')}{' '}
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
        <Button size="small" variant="outlined" aria-label={t('invite.shareAria')} onClick={share}>
          {t('invite.share')}
        </Button>
      </Stack>
      {outcome === 'copied' ? <Alert severity="success">{t('invite.copied')}</Alert> : null}
      {outcome === 'manual' ? (
        <Alert severity="info">{t('invite.manual', { message })}</Alert>
      ) : null}
    </Stack>
  )
}
