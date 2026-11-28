import { Alert, Button, Stack, Typography } from '@mui/material'
import { formatDay } from '../domain/dates'
import { useTranslation } from '../i18n/useTranslation'

interface ExpensePeriodBannerProps {
  // The date when expenses will reset, YYYY-MM-DD
  closeDate: string
  onSettleExpenses: () => void
}

// A persistent, non-dismissible banner shown on the week tab in the 7 days before an expense period
// closes. It nudges housemates to settle up before the reset. The button goes under the text: at the
// side it was squeezed into two lines.
export const ExpensePeriodBanner = ({ closeDate, onSettleExpenses }: ExpensePeriodBannerProps) => {
  const { t, locale } = useTranslation()
  return (
    <Alert severity="warning" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
      <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
        <Typography variant="body2">
          {t('period.warning', { date: formatDay(closeDate, locale) })}
        </Typography>
        <Button color="inherit" size="small" onClick={onSettleExpenses} sx={{ ml: -1 }}>
          {t('period.settle')}
        </Button>
      </Stack>
    </Alert>
  )
}
