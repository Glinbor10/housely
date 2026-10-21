import { useState } from 'react'
import { Alert, Button, LinearProgress, Radio, Stack, TextField, Typography } from '@mui/material'
import { normalizeDraft, validateDraft, type FlatDraft } from '../domain/flat'
import { useTranslation } from '../i18n/useTranslation'
import { describeDraftError } from './draftMessages'

interface CreateFlatFormProps {
  initialStartDate: string
  busy: boolean
  submitError: string | null
  onSubmit: (draft: FlatDraft, ownerName: string) => void
  onBack: () => void
}

const STEPS = 3

// Which step each validation problem belongs to: a step only blocks on its own problems.
const STEP_CODES: string[][] = [
  ['flat-name-required', 'flat-name-too-long', 'start-date-invalid'],
  [
    'members-required',
    'members-too-many',
    'member-name-too-long',
    'members-duplicated',
    'owner-required',
  ],
  [
    'zones-required',
    'zones-too-many',
    'zone-name-too-long',
    'zone-name-invalid',
    'zones-duplicated',
  ],
]

const replaceAt = (items: string[], index: number, value: string): string[] =>
  items.map((item, position) => (position === index ? value : item))

const removeAt = (items: string[], index: number): string[] =>
  items.filter((_, position) => position !== index)

export const CreateFlatForm = ({
  initialStartDate,
  busy,
  submitError,
  onSubmit,
  onBack,
}: CreateFlatFormProps) => {
  const { t } = useTranslation()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [members, setMembers] = useState(['', ''])
  const [zones, setZones] = useState(() => t('create.suggestedZones').split('|'))
  const [startDate, setStartDate] = useState(initialStartDate)
  // Index of the member row that is the person creating the flat
  const [ownerIndex, setOwnerIndex] = useState(0)
  const [errors, setErrors] = useState<string[]>([])

  const lastStep = step === STEPS - 1

  const findProblems = (): { draft: FlatDraft; ownerName: string; problems: string[] } => {
    const draft = normalizeDraft({ name, members, zones, startDate })
    const ownerName = normalizeDraft({
      name,
      members: [members[ownerIndex] ?? ''],
      zones,
      startDate,
    }).members[0]
    const found = validateDraft(draft)
    return { draft, ownerName, problems: ownerName ? found : [...found, 'owner-required'] }
  }

  const goNext = () => {
    const { problems } = findProblems()
    const blocking = problems.filter((code) => STEP_CODES[step].includes(code))
    setErrors(blocking)
    if (blocking.length === 0) setStep(step + 1)
  }

  const submit = () => {
    const { draft, ownerName, problems } = findProblems()
    setErrors(problems)
    if (problems.length === 0) onSubmit(draft, ownerName)
  }

  const goBack = () => {
    setErrors([])
    if (step === 0) onBack()
    else setStep(step - 1)
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h5">{t('create.title')}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t('create.step', { n: step + 1, total: STEPS })}
        </Typography>
        <LinearProgress
          aria-hidden="true"
          variant="determinate"
          value={((step + 1) / STEPS) * 100}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Stack>

      {step === 0 ? (
        <Stack spacing={2}>
          <Typography variant="subtitle1">{t('create.stepTitle.flat')}</Typography>
          <TextField
            label={t('create.flatName')}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <TextField
            type="date"
            label={t('create.start')}
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
      ) : step === 1 ? (
        <Stack spacing={1}>
          <Typography variant="subtitle1">{t('create.people')}</Typography>
          {members.map((member, index) => (
            <Stack key={index} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Radio
                checked={ownerIndex === index}
                onChange={() => setOwnerIndex(index)}
                slotProps={{ input: { 'aria-label': t('create.personIsMe', { n: index + 1 }) } }}
              />
              <TextField
                fullWidth
                size="small"
                label={t('create.person', { n: index + 1 })}
                value={member}
                onChange={(event) => setMembers(replaceAt(members, index, event.target.value))}
              />
              <Button
                aria-label={t('create.removePerson', { n: index + 1 })}
                disabled={members.length === 1}
                onClick={() => {
                  setMembers(removeAt(members, index))
                  setOwnerIndex(ownerIndex >= index && ownerIndex > 0 ? ownerIndex - 1 : ownerIndex)
                }}
              >
                {t('common.remove')}
              </Button>
            </Stack>
          ))}
          <Button onClick={() => setMembers([...members, ''])}>{t('create.addPerson')}</Button>
          <Typography variant="caption" color="text.secondary">
            {t('create.selectMe')}
          </Typography>
        </Stack>
      ) : (
        <Stack spacing={1}>
          <Typography variant="subtitle1">{t('create.zones')}</Typography>
          {zones.map((zone, index) => (
            <Stack key={index} direction="row" spacing={1}>
              <TextField
                fullWidth
                size="small"
                label={t('create.zone', { n: index + 1 })}
                value={zone}
                onChange={(event) => setZones(replaceAt(zones, index, event.target.value))}
              />
              <Button
                aria-label={t('create.removeZone', { n: index + 1 })}
                disabled={zones.length === 1}
                onClick={() => setZones(removeAt(zones, index))}
              >
                {t('common.remove')}
              </Button>
            </Stack>
          ))}
          <Button onClick={() => setZones([...zones, ''])}>{t('create.addZone')}</Button>
        </Stack>
      )}

      {errors.length > 0 ? (
        <Alert severity="error">
          {errors.map((code) => (
            <div key={code}>{describeDraftError(code)}</div>
          ))}
        </Alert>
      ) : null}
      {lastStep && submitError ? <Alert severity="error">{submitError}</Alert> : null}

      <Stack direction="row" spacing={1}>
        <Button onClick={goBack}>{t('common.back')}</Button>
        {lastStep ? (
          <Button variant="contained" disabled={busy} onClick={submit}>
            {busy ? t('create.creating') : t('create.submit')}
          </Button>
        ) : (
          <Button variant="contained" onClick={goNext}>
            {t('create.next')}
          </Button>
        )}
      </Stack>
    </Stack>
  )
}
