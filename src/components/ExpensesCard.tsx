import { SIZE } from '../theme'
import { Box, Card, CardActionArea, CardContent, Stack, Typography } from '@mui/material'
import { formatEuros } from '../domain/money'
import { useTranslation } from '../i18n/useTranslation'
import { SplitIcon } from './icons'

interface ExpensesCardProps {
  // False while the subscription has not yet delivered its first snapshot
  loaded: boolean
  hasExpenses: boolean
  // What the current person is owed (positive) or owes (negative), in cents
  balanceCents: number
  onOpen: () => void
}

// The way into the expenses, from My flat. It already says where the person stands.
export const ExpensesCard = ({ loaded, hasExpenses, balanceCents, onOpen }: ExpensesCardProps) => {
  const { t, locale } = useTranslation()
  const summary = !loaded
    ? t('expenses.card.loading')
    : !hasExpenses
      ? t('expenses.card.empty')
      : balanceCents > 0
        ? t('expenses.card.owed', { amount: formatEuros(balanceCents, locale) })
        : balanceCents < 0
          ? t('expenses.card.owe', { amount: formatEuros(-balanceCents, locale) })
          : t('expenses.card.settled')
  return (
    <Card variant="outlined" sx={{ borderColor: 'primary.main' }}>
      <CardActionArea onClick={onOpen}>
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Box
              aria-hidden="true"
              sx={{
                width: SIZE.avatarLg,
                height: SIZE.avatarLg,
                flexShrink: 0,
                borderRadius: 3,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
              }}
            >
              <SplitIcon sx={{ fontSize: 30 }} />
            </Box>
            <Box>
              <Typography variant="h6" component="span" sx={{ display: 'block' }}>
                {t('expenses.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {summary}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}
