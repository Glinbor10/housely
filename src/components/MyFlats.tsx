import { Alert, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { useTranslation } from '../i18n/useTranslation'

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

export const MyFlats = ({ flats, busy, error, onOpen, onBack }: MyFlatsProps) => {
  const { t } = useTranslation()
  return (
    <Stack spacing={3}>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
        {t('myFlats.title')}
      </Typography>

      {flats === null && !error ? (
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <CircularProgress size={24} aria-label={t('common.loading')} />
          <Typography>{t('myFlats.looking')}</Typography>
        </Stack>
      ) : null}

      {flats !== null && flats.length === 0 ? (
        <Alert severity="info">{t('myFlats.none')}</Alert>
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
      <Button onClick={onBack}>{t('common.back')}</Button>
    </Stack>
  )
}
