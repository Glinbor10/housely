import { Avatar, Box, Button, Stack, Typography } from '@mui/material'
import { readableOn } from '../domain/color'
import { useTranslation } from '../i18n/useTranslation'
import { SIZE } from '../theme'
import { ArrowRightIcon } from './icons'

// The sentence that says it all, for who cannot see the drawing: it stays in the page but out of sight
const HIDDEN = {
  position: 'absolute',
  // In px on purpose: in sx a bare 1 means 100%
  width: '1px',
  height: '1px',
  m: '-1px',
  p: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const

// A round badge in the color of a person, with their initial
export const Person = ({
  name,
  color,
  size = SIZE.avatarSm,
}: {
  name: string
  color: string
  size?: number
}) => (
  <Avatar
    aria-hidden="true"
    sx={{ width: size, height: size, fontSize: 15, bgcolor: color, color: readableOn(color) }}
  >
    {name.charAt(0).toUpperCase()}
  </Avatar>
)

interface Someone {
  id: string
  name: string
  color: string
}

interface BalanceBarsProps {
  // The people with something to settle, and what each is owed (positive) or owes (negative), in cents
  people: Someone[]
  net: Record<string, number>
  euros: (cents: number) => string
}

// Who is owed and who owes, at a glance: a bar from the middle for each person, to the right and green
// when they are owed, to the left and red when they owe. The amount is written too, with its sign, so
// the color is never the only clue.
export const BalanceBars = ({ people, net, euros }: BalanceBarsProps) => {
  const { t } = useTranslation()
  const biggest = Math.max(...people.map((person) => Math.abs(net[person.id] ?? 0)), 1)
  return (
    <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', p: 0, m: 0 }}>
      {people.map((person) => {
        const amount = net[person.id] ?? 0
        const owed = amount > 0
        // Half of the track is for each side; even the smallest amount gets a bar that can be seen
        const share = Math.max(6, (Math.abs(amount) / biggest) * 50)
        return (
          <Stack
            key={person.id}
            component="li"
            direction="row"
            spacing={1.5}
            sx={{ alignItems: 'center', position: 'relative' }}
          >
            <Person name={person.name} color={person.color} />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="body2" aria-hidden="true" sx={{ fontWeight: 700 }}>
                {person.name}
              </Typography>
              <Box
                aria-hidden="true"
                sx={{
                  position: 'relative',
                  height: 12,
                  borderRadius: 6,
                  bgcolor: 'action.hover',
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: owed ? '50%' : `${50 - share}%`,
                    width: `${share}%`,
                    bgcolor: owed ? 'success.main' : 'error.main',
                  }}
                />
                {/* The middle line: zero */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 'calc(50% - 1px)',
                    width: 2,
                    bgcolor: 'background.paper',
                  }}
                />
              </Box>
            </Box>
            <Typography
              aria-hidden="true"
              sx={{
                fontWeight: 800,
                minWidth: 88,
                textAlign: 'right',
                // The text uses a deeper green on light and a lighter one on dark: success.main alone
                // does not reach the contrast of text
                color: (theme) =>
                  owed
                    ? theme.palette.mode === 'dark'
                      ? theme.palette.success.light
                      : theme.palette.success.dark
                    : theme.palette.error.main,
              }}
            >
              {owed ? '+' : '−'}
              {euros(Math.abs(amount))}
            </Typography>
            <Box component="span" sx={HIDDEN}>
              {owed
                ? t('expenses.isOwed', { name: person.name, amount: euros(amount) })
                : t('expenses.owes', { name: person.name, amount: euros(-amount) })}
            </Box>
          </Stack>
        )
      })}
    </Stack>
  )
}

interface Payment {
  from: string
  to: string
  amountCents: number
}

interface PaymentFlowsProps {
  payments: Payment[]
  currentMemberId: string
  busy: boolean
  nameOf: (id: string) => string
  colorOf: (id: string) => string
  euros: (cents: number) => string
  onPay: (payment: Payment) => void
}

// The payments that settle everything, drawn: who pays (left), how much, and who receives (right).
export const PaymentFlows = ({
  payments,
  currentMemberId,
  busy,
  nameOf,
  colorOf,
  euros,
  onPay,
}: PaymentFlowsProps) => {
  const { t } = useTranslation()
  return (
    // One line per payment, with its own button inside: it is clear which payment it settles
    <Stack component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
      {payments.map((payment, index) => (
        <Stack
          key={`${payment.from}_${payment.to}`}
          component="li"
          spacing={1}
          sx={{ py: 1.5, borderTop: index === 0 ? 0 : 1, borderColor: 'divider' }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }} aria-hidden="true">
            <Person
              name={nameOf(payment.from)}
              color={colorOf(payment.from)}
              size={SIZE.avatarSm}
            />
            <Typography noWrap sx={{ minWidth: 0, fontWeight: 600 }}>
              {nameOf(payment.from)}
            </Typography>
            <ArrowRightIcon sx={{ color: 'primary.main', flexShrink: 0 }} />
            <Person name={nameOf(payment.to)} color={colorOf(payment.to)} size={SIZE.avatarSm} />
            <Typography noWrap sx={{ minWidth: 0, fontWeight: 600, flexGrow: 1 }}>
              {nameOf(payment.to)}
            </Typography>
            <Typography sx={{ fontWeight: 800, flexShrink: 0 }}>
              {euros(payment.amountCents)}
            </Typography>
          </Stack>
          <Box component="span" sx={HIDDEN}>
            {t('expenses.pays', {
              from: nameOf(payment.from),
              to: nameOf(payment.to),
              amount: euros(payment.amountCents),
            })}
          </Box>
          {payment.from === currentMemberId || payment.to === currentMemberId ? (
            <Button
              size="small"
              variant="outlined"
              disabled={busy}
              sx={{ alignSelf: 'flex-end' }}
              aria-label={t('expenses.markPaidAria', {
                from: nameOf(payment.from),
                to: nameOf(payment.to),
                amount: euros(payment.amountCents),
              })}
              onClick={() => onPay(payment)}
            >
              {t('expenses.markPaid')}
            </Button>
          ) : null}
        </Stack>
      ))}
    </Stack>
  )
}
