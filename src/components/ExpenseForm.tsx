import { useState } from 'react'
import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  FormHelperText,
  Stack,
  TextField,
} from '@mui/material'
import { validateExpense, type Expense } from '../domain/expenses'
import { parseEuros } from '../domain/money'
import type { MessageKey } from '../i18n/i18n'
import { useTranslation } from '../i18n/useTranslation'

// What the person wrote. Who wrote it and its id are added by the screen.
export interface ExpenseDraft {
  title: string
  amountCents: number
  paidBy: string
  participants: string[]
  date: string
}

interface ExpenseFormProps {
  people: Array<{ id: string; name: string }>
  currentMemberId: string
  // Local calendar date of today, YYYY-MM-DD
  today: string
  // Set when an expense is being edited
  initial?: Expense
  busy: boolean
  error: string | null
  onSave: (draft: ExpenseDraft) => void
  onCancel: () => void
}

// Where an expense is written or edited. It is split equally between everybody unless the person
// says it is only between some people.
export const ExpenseForm = ({
  people,
  currentMemberId,
  today,
  initial,
  busy,
  error,
  onSave,
  onCancel,
}: ExpenseFormProps) => {
  const { t } = useTranslation()
  const everybody = people.map((person) => person.id)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [amount, setAmount] = useState(initial ? (initial.amountCents / 100).toFixed(2) : '')
  const [paidBy, setPaidBy] = useState(initial?.paidBy ?? currentMemberId)
  const [date, setDate] = useState(initial?.date ?? today)
  const [equal, setEqual] = useState(initial ? initial.participants.length === people.length : true)
  const [chosen, setChosen] = useState<string[]>(initial?.participants ?? everybody)
  const [problems, setProblems] = useState<string[]>([])

  const toggle = (id: string) =>
    setChosen(chosen.includes(id) ? chosen.filter((item) => item !== id) : [...chosen, id])

  const save = () => {
    const amountCents = parseEuros(amount)
    const participants = equal ? everybody : everybody.filter((id) => chosen.includes(id))
    const found = validateExpense({
      id: '',
      kind: 'expense',
      title,
      amountCents: amountCents ?? 0,
      paidBy,
      participants,
      date,
      createdBy: currentMemberId,
    })
    setProblems(found)
    if (found.length === 0 && amountCents !== null) {
      onSave({ title: title.trim(), amountCents, paidBy, participants, date })
    }
  }

  // What is wrong, field by field: the message sits next to the field it is about and is read with it
  const messageFor = (codes: string[]): string =>
    problems
      .filter((code) => codes.includes(code))
      .map((code) => t(`expenses.error.${code}` as MessageKey))
      .join(' ')
  const titleMessage = messageFor(['title-required', 'title-too-long'])
  const amountMessage = messageFor(['amount-invalid'])
  const paidByMessage = messageFor(['payer-required'])
  const dateMessage = messageFor(['date-invalid'])
  const participantsMessage = messageFor([
    'participants-required',
    'participants-duplicated',
    'participants-too-many',
  ])
  // Anything that no field owns still needs to be said
  const otherProblems = problems.filter(
    (code) =>
      ![
        'title-required',
        'title-too-long',
        'amount-invalid',
        'payer-required',
        'date-invalid',
        'participants-required',
        'participants-duplicated',
        'participants-too-many',
      ].includes(code),
  )

  return (
    <Stack spacing={2}>
      <TextField
        // The form opens under the person's finger: start on the first field
        autoFocus
        label={t('expenses.form.title')}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        error={titleMessage !== ''}
        helperText={titleMessage || undefined}
      />
      <TextField
        label={t('expenses.form.amount')}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        error={amountMessage !== ''}
        helperText={amountMessage || undefined}
        slotProps={{ htmlInput: { inputMode: 'decimal' } }}
      />
      <TextField
        select
        label={t('expenses.form.paidBy')}
        value={paidBy}
        onChange={(event) => setPaidBy(event.target.value)}
        error={paidByMessage !== ''}
        helperText={paidByMessage || undefined}
        slotProps={{ select: { native: true } }}
      >
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
      </TextField>
      <TextField
        type="date"
        label={t('expenses.form.date')}
        value={date}
        onChange={(event) => setDate(event.target.value)}
        error={dateMessage !== ''}
        helperText={dateMessage || undefined}
        slotProps={{ inputLabel: { shrink: true } }}
      />

      <Stack>
        <FormControlLabel
          control={
            <Checkbox
              checked={equal}
              onChange={(event) => {
                setEqual(event.target.checked)
                // Choosing people starts from everybody, so unticking one is all it takes
                if (!event.target.checked && chosen.length === 0) setChosen(everybody)
              }}
            />
          }
          label={t('expenses.form.equal')}
        />
        {equal ? null : (
          <Stack sx={{ pl: 3 }}>
            {people.map((person) => (
              <FormControlLabel
                key={person.id}
                control={
                  <Checkbox
                    checked={chosen.includes(person.id)}
                    onChange={() => toggle(person.id)}
                  />
                }
                label={person.name}
              />
            ))}
          </Stack>
        )}
        {participantsMessage ? (
          <FormHelperText error role="alert">
            {participantsMessage}
          </FormHelperText>
        ) : null}
      </Stack>

      {otherProblems.length > 0 ? (
        <Alert severity="error">
          {otherProblems.map((code) => (
            <div key={code}>{t(`expenses.error.${code}` as MessageKey)}</div>
          ))}
        </Alert>
      ) : null}
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Stack direction="row" spacing={1}>
        <Button onClick={onCancel}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={busy} sx={{ flexGrow: 1 }} onClick={save}>
          {busy ? t('common.saving') : t('common.save')}
        </Button>
      </Stack>
    </Stack>
  )
}
