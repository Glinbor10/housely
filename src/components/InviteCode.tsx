import { Stack, Typography } from '@mui/material'
import { useTranslation } from '../i18n/useTranslation'
import { ShareButton } from './ShareButton'

interface InviteCodeProps {
  code: string
  // The address of the app, sent together with the code so flatmates can open it
  appUrl: string
}

export const InviteCode = ({ code, appUrl }: InviteCodeProps) => {
  const { t } = useTranslation()
  return (
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
      <ShareButton
        message={t('invite.message', { code, url: appUrl })}
        url={appUrl}
        label={t('invite.share')}
        size="small"
      />
    </Stack>
  )
}
