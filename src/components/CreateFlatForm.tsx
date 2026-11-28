import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Radio,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { m } from 'motion/react'
import { normalizeDraft, validateDraft, type FlatDraft } from '../domain/flat'
import { colorForPerson } from '../domain/palette'
import { useTranslation } from '../i18n/useTranslation'
import { ColorPicker } from './ColorPicker'
import { describeDraftError } from './draftMessages'
import { StartWeekPreview } from './StartWeekPreview'

interface CreateFlatFormProps {
  initialStartDate: string
  busy: boolean
  submitError: string | null
  // The creator is one of the people, with the color they chose
  onSubmit: (draft: FlatDraft, ownerName: string, ownerColor: string) => void
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
  const [direction, setDirection] = useState(1)
  const [name, setName] = useState('')
  const [members, setMembers] = useState(['', ''])
  const [zones, setZones] = useState(() => t('create.suggestedZones').split('|'))
  const [startDate, setStartDate] = useState(initialStartDate)
  // Index of the member row that is the person creating the flat
  const [ownerIndex, setOwnerIndex] = useState(0)
  // Null until the creator chooses one: then the color of their place is used
  const [chosenColor, setChosenColor] = useState<string | null>(null)
  const ownerColor = chosenColor ?? colorForPerson(ownerIndex)
  const [errors, setErrors] = useState<string[]>([])

  const lastStep = step === STEPS - 1
  // The problems of the name show under the name; the others in the box below
  const nameErrors = errors.filter((code) => code.startsWith('flat-name'))
  const otherErrors = errors.filter((code) => !code.startsWith('flat-name'))

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
    if (blocking.length === 0) {
      setDirection(1)
      setStep(step + 1)
    }
  }

  const submit = () => {
    const { draft, ownerName, problems } = findProblems()
    setErrors(problems)
    if (problems.length === 0) onSubmit(draft, ownerName, ownerColor)
  }

  const goBack = () => {
    setErrors([])
    if (step === 0) onBack()
    else {
      setDirection(-1)
      setStep(step - 1)
    }
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

      <Box sx={{ overflow: 'hidden' }}>
        <m.div
          key={step}
          initial={{ opacity: 0, x: direction * 48 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {step === 0 ? (
            <Stack spacing={2}>
              <TextField
                autoFocus
                label={t('create.flatName')}
                value={name}
                onChange={(event) => setName(event.target.value)}
                error={nameErrors.length > 0}
                helperText={nameErrors.map((code) => describeDraftError(code)).join(' ')}
              />
              <Typography variant="h6" component="h2">
                {t('create.start')}
              </Typography>
              <StartWeekPreview value={startDate} onChange={setStartDate} />
            </Stack>
          ) : step === 1 ? (
            <Stack spacing={1}>
              <Typography variant="subtitle1">{t('create.people')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t('create.selectMe')}
              </Typography>
              {members.map((member, index) => (
                <Stack key={index} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Radio
                    checked={ownerIndex === index}
                    onChange={() => setOwnerIndex(index)}
                    slotProps={{
                      input: { 'aria-label': t('create.personIsMe', { n: index + 1 }) },
                    }}
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
                      setOwnerIndex(
                        ownerIndex >= index && ownerIndex > 0 ? ownerIndex - 1 : ownerIndex,
                      )
                    }}
                  >
                    {t('common.remove')}
                  </Button>
                </Stack>
              ))}
              <Button onClick={() => setMembers([...members, ''])}>{t('create.addPerson')}</Button>
              <Typography variant="subtitle2" sx={{ pt: 1 }}>
                {t('people.yourColor')}
              </Typography>
              <ColorPicker
                value={ownerColor}
                takenBy={{}}
                busy={false}
                onChange={(hex) => setChosenColor(hex)}
              />
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
        </m.div>
      </Box>

      {otherErrors.length > 0 ? (
        <Alert severity="error">
          {otherErrors.map((code) => (
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
