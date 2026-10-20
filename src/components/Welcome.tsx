import { Button, Stack, Typography } from '@mui/material'
import { useTranslation } from '../i18n/useTranslation'
import { Mascot } from './Mascot'

interface WelcomeProps {
  onCreate: () => void
  onJoin: () => void
  onSignIn: () => void
}

export const Welcome = ({ onCreate, onJoin, onSignIn }: WelcomeProps) => {
  const { t } = useTranslation()
  return (
    <Stack spacing={3} sx={{ alignItems: 'center', textAlign: 'center', pt: 4 }}>
      <Mascot mood="happy" size={132} />
      <Stack spacing={1}>
        <Typography variant="h3" component="h1" sx={{ fontWeight: 700 }}>
          Housely
        </Typography>
        <Typography color="text.secondary">{t('welcome.tagline')}</Typography>
      </Stack>
      <Stack spacing={2} sx={{ width: '100%' }}>
        <Button variant="contained" size="large" onClick={onCreate}>
          {t('welcome.create')}
        </Button>
        <Button variant="outlined" size="large" onClick={onJoin}>
          {t('welcome.join')}
        </Button>
        <Button onClick={onSignIn}>{t('welcome.signIn')}</Button>
      </Stack>
    </Stack>
  )
}
