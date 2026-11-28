import { MIN_TOUCH_TARGET, SIZE } from '../theme'
import { UNKNOWN_PERSON_COLOR } from '../domain/palette'
import { BalanceBars, PaymentFlows, Person } from './ExpenseCharts'
import { ShareButton } from './ShareButton'
import { useRef, useState, type ReactNode } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  IconButton,
  Stack,
  Typography,
} from '@mui/material'
import { m } from 'motion/react'
import { formatDay } from '../domain/dates'
import { balances, settlementPayments, type Expense, type Payment } from '../domain/expenses'
import { formatEuros } from '../domain/money'
import { useTranslation } from '../i18n/useTranslation'
import { EmptyState } from './EmptyState'
import { ExpenseForm, type ExpenseDraft } from './ExpenseForm'
import { useLayer, type LayerProps } from './useLayer'
import { ArrowRightIcon, CheckIcon, EditIcon, ReceiptArrowsIcon, TrashIcon } from './icons'

interface ExpensesViewProps extends LayerProps {
  expenses: Expense[]
  people: Array<{ id: string; name: string; color: string }>
  currentMemberId: string
  // Local calendar date of today, YYYY-MM-DD
  today: string
  busy: boolean
  error: string | null
  // Below everything and small: the link to Tricount, for the people who still use it
  footer: ReactNode
  // When set, shows a WhatsApp share button with a settlement summary for the closing period
  periodCloseDate?: string
  flatName?: string
  // Each resolves to whether it was saved
  onAdd: (draft: ExpenseDraft) => Promise<boolean>
  onEdit: (expense: Expense, draft: ExpenseDraft) => Promise<boolean>
  onPay: (payment: Payment) => Promise<boolean>
  onDelete: (expenseId: string) => void
}

type Mode = { kind: 'list' } | { kind: 'adding' } | { kind: 'editing'; expense: Expense }

// How many expenses show before "show more"
const MAX_EXPENSES_SHOWN = 4

// The expenses of the flat. The first thing is where the person stands; then who owes whom, the payments
// that settle it, and every expense. Tricount is only a small link at the very bottom.
export const ExpensesView = ({
  expenses,
  people,
  currentMemberId,
  today,
  busy,
  error,
  footer,
  periodCloseDate,
  flatName,
  onAdd,
  onEdit,
  onPay,
  onDelete,
  layer,
  onOpenLayer,
  onCloseLayer,
}: ExpensesViewProps) => {
  const { t, locale } = useTranslation()
  // The form to add or edit an expense is a layer: the back button closes it
  const layers = useLayer({ layer, onOpenLayer, onCloseLayer })
  const edited = expenses.find((item) => `expense:${item.id}` === layers.current)
  const mode: Mode =
    layers.current === 'expense:new'
      ? { kind: 'adding' }
      : edited
        ? { kind: 'editing', expense: edited }
        : { kind: 'list' }
  const closeForm = () => layers.close(layers.current ?? '')
  // The form replaces the button that opens it: when it goes away, the cursor goes back to that button, so
  // a keyboard or a screen reader does not lose its place. Closing can also come from the back button.
  const formWasOpen = useRef(false)
  const rememberFormOpen = (element: HTMLElement | null) => {
    if (element) formWasOpen.current = true
  }
  const focusAddButton = (element: HTMLButtonElement | null) => {
    if (element && formWasOpen.current) {
      formWasOpen.current = false
      element.focus()
    }
  }
  // The expense whose delete is waiting for a confirmation
  const [deleting, setDeleting] = useState<string | null>(null)

  const nameOf = (id: string) => people.find((person) => person.id === id)?.name ?? '?'
  const colorOf = (id: string) =>
    people.find((person) => person.id === id)?.color ?? UNKNOWN_PERSON_COLOR
  const euros = (cents: number) => formatEuros(cents, locale)
  const net = balances(expenses)
  const payments = settlementPayments(net)
  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date))
  // Only the latest ones show at first: the rest are behind "show more"
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? sorted : sorted.slice(0, MAX_EXPENSES_SHOWN)
  const unsettled = people.filter((person) => (net[person.id] ?? 0) !== 0)
  const mine = net[currentMemberId] ?? 0
  const standing = expenses.length === 0 ? 'empty' : mine > 0 ? 'owed' : mine < 0 ? 'owe' : 'even'

  const buildWhatsAppText = (): string => {
    const total = expenses.reduce((sum, e) => (e.kind === 'expense' ? sum + e.amountCents : sum), 0)
    const dateLabel = periodCloseDate ? formatDay(periodCloseDate, locale) : ''
    const header = `🧾 ${t('period.whatsapp.header', { name: flatName ?? '', date: dateLabel })}\n`
    const totalLine = `💰 ${t('period.whatsapp.total', { amount: euros(total) })}\n`
    const balanceLines = people
      .filter((p) => net[p.id] !== undefined && net[p.id] !== 0)
      .map((p) =>
        net[p.id] > 0
          ? `${p.name}: +${euros(net[p.id])} (${t('period.whatsapp.owed')})`
          : `${p.name}: -${euros(-net[p.id])} (${t('period.whatsapp.owes')})`,
      )
      .join('\n')
    const paymentLines =
      payments.length > 0
        ? `\n${t('period.whatsapp.pending')}:\n` +
          payments
            .map((pmt) => `· ${nameOf(pmt.from)} → ${nameOf(pmt.to)}: ${euros(pmt.amountCents)}`)
            .join('\n')
        : ''
    const footer = `\n${t('period.whatsapp.settle', { date: dateLabel })}`
    return header + totalLine + balanceLines + paymentLines + footer
  }

  return (
    <Stack spacing={3}>
      <Typography
        variant="h5"
        component="h2"
        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <ReceiptArrowsIcon colored aria-hidden="true" sx={{ fontSize: 32 }} />
        {t('expenses.title')}
      </Typography>

      <Card
        variant="outlined"
        data-standing={standing}
        sx={{
          borderColor:
            standing === 'owed' ? 'success.main' : standing === 'owe' ? 'error.main' : 'divider',
          borderWidth: 2,
        }}
      >
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Box
              aria-hidden="true"
              sx={{
                width: SIZE.hero,
                height: SIZE.hero,
                flexShrink: 0,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                bgcolor:
                  standing === 'owed'
                    ? 'success.main'
                    : standing === 'owe'
                      ? 'error.main'
                      : 'primary.main',
                color:
                  standing === 'owed'
                    ? 'success.contrastText'
                    : standing === 'owe'
                      ? 'error.contrastText'
                      : 'primary.contrastText',
              }}
            >
              {standing === 'owed' ? (
                <ArrowRightIcon sx={{ transform: 'rotate(-90deg)', fontSize: 32 }} />
              ) : standing === 'owe' ? (
                <ArrowRightIcon sx={{ transform: 'rotate(90deg)', fontSize: 32 }} />
              ) : standing === 'even' ? (
                <CheckIcon sx={{ fontSize: 32 }} />
              ) : (
                <ReceiptArrowsIcon sx={{ fontSize: 32 }} />
              )}
            </Box>
            <Box>
              <Typography color="text.secondary">
                {t(`expenses.hero.${standing}` as const)}
              </Typography>
              {standing === 'owed' || standing === 'owe' ? (
                <Typography variant="h4" component="p" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                  {euros(Math.abs(mine))}
                </Typography>
              ) : null}
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {periodCloseDate && mode.kind === 'list' ? (
        <ShareButton
          message={buildWhatsAppText()}
          label={t('period.whatsapp.share')}
          variant="outlined"
          size="large"
          fullWidth
        />
      ) : null}
      {mode.kind === 'list' ? (
        <Button
          ref={focusAddButton}
          variant="contained"
          size="large"
          fullWidth
          onClick={() => layers.open('expense:new')}
        >
          {t('expenses.add')}
        </Button>
      ) : (
        <Card variant="outlined" ref={rememberFormOpen}>
          <CardContent>
            <ExpenseForm
              people={people}
              currentMemberId={currentMemberId}
              today={today}
              initial={mode.kind === 'editing' ? mode.expense : undefined}
              busy={busy}
              error={error}
              onCancel={closeForm}
              onSave={async (draft) => {
                const saved =
                  mode.kind === 'editing' ? await onEdit(mode.expense, draft) : await onAdd(draft)
                if (saved) closeForm()
              }}
            />
          </CardContent>
        </Card>
      )}

      <Stack component="section" aria-label={t('expenses.balances')} spacing={1.5}>
        <Typography variant="h6" component="h3">
          {t('expenses.balances')}
        </Typography>
        {unsettled.length === 0 ? (
          <Typography color="text.secondary">{t('expenses.settled')}</Typography>
        ) : (
          <BalanceBars people={unsettled} net={net} euros={euros} />
        )}
      </Stack>

      {payments.length > 0 ? (
        <Stack component="section" aria-label={t('expenses.settleUp')} spacing={1.5}>
          <Typography variant="h6" component="h3">
            {t('expenses.settleUp')}
          </Typography>
          <PaymentFlows
            payments={payments}
            currentMemberId={currentMemberId}
            busy={busy}
            nameOf={nameOf}
            colorOf={colorOf}
            euros={euros}
            onPay={onPay}
          />
        </Stack>
      ) : null}

      <Stack spacing={1}>
        <Typography variant="h6" component="h3">
          {t('expenses.list')}
        </Typography>
        {sorted.length === 0 ? (
          <EmptyState text={t('expenses.empty')} />
        ) : (
          <Stack component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
            {visible.map((expense, index) => {
              const own = expense.createdBy === currentMemberId
              const isPayment = expense.kind === 'payment'
              return (
                <Box
                  key={expense.id}
                  component={m.li}
                  data-expense={expense.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 260,
                    damping: 24,
                    delay: index * 0.04,
                  }}
                  sx={{
                    py: 1.5,
                    borderTop: index === 0 ? 0 : 1,
                    borderColor: 'divider',
                  }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                    {isPayment ? (
                      <Box
                        aria-hidden="true"
                        sx={{
                          width: SIZE.avatarMd,
                          height: SIZE.avatarMd,
                          flexShrink: 0,
                          borderRadius: 2,
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: 'action.hover',
                          color: 'primary.main',
                        }}
                      >
                        <ArrowRightIcon />
                      </Box>
                    ) : (
                      // Who paid, in their color: it is told at a glance when going down the list
                      <Person
                        name={nameOf(expense.paidBy)}
                        color={colorOf(expense.paidBy)}
                        size={SIZE.avatarMd}
                      />
                    )}
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="subtitle1" component="h4" sx={{ fontWeight: 700 }}>
                        {isPayment
                          ? t('expenses.paid', {
                              from: nameOf(expense.paidBy),
                              to: nameOf(expense.participants[0]),
                            })
                          : expense.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {isPayment
                          ? formatDay(expense.date, locale)
                          : `${t('expenses.paidBy', { name: nameOf(expense.paidBy) })} · ${
                              expense.participants.length === people.length
                                ? t('expenses.splitAll')
                                : t('expenses.splitSome', { n: expense.participants.length })
                            } · ${formatDay(expense.date, locale)}`}
                      </Typography>
                    </Box>
                    <Stack sx={{ alignItems: 'flex-end' }}>
                      <Typography
                        sx={{ fontWeight: 800, color: isPayment ? 'text.primary' : 'error.main' }}
                      >
                        {euros(expense.amountCents)}
                      </Typography>
                      {own ? (
                        <Stack direction="row">
                          {isPayment ? null : (
                            <IconButton
                              size="small"
                              sx={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET }}
                              aria-label={t('expenses.editAria', { title: expense.title })}
                              onClick={() => layers.open(`expense:${expense.id}`)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          )}
                          <IconButton
                            size="small"
                            sx={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET }}
                            aria-label={t('expenses.deleteAria', {
                              title: isPayment ? t('expenses.payment') : expense.title,
                            })}
                            onClick={() => setDeleting(expense.id)}
                          >
                            <TrashIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      ) : null}
                    </Stack>
                  </Stack>
                  {deleting === expense.id ? (
                    <Alert
                      severity="warning"
                      sx={{ mt: 1 }}
                      action={
                        <Stack direction="row" spacing={1}>
                          <Button color="inherit" onClick={() => setDeleting(null)}>
                            {t('common.cancel')}
                          </Button>
                          <Button
                            color="error"
                            onClick={() => {
                              onDelete(expense.id)
                              setDeleting(null)
                            }}
                          >
                            {t('expenses.deleteConfirm')}
                          </Button>
                        </Stack>
                      }
                    >
                      {t('expenses.deleteText')}
                    </Alert>
                  ) : null}
                </Box>
              )
            })}
          </Stack>
        )}
        {sorted.length > MAX_EXPENSES_SHOWN ? (
          <Button sx={{ alignSelf: 'center' }} onClick={() => setShowAll(!showAll)}>
            {showAll
              ? t('expenses.showLess')
              : t('expenses.showMore', { n: sorted.length - MAX_EXPENSES_SHOWN })}
          </Button>
        ) : null}
      </Stack>

      {error && mode.kind === 'list' ? <Alert severity="error">{error}</Alert> : null}

      <Divider />
      <Box>{footer}</Box>
    </Stack>
  )
}
