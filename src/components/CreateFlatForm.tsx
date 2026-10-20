import { useState } from 'react'
import { Alert, Button, Radio, Stack, TextField, Typography } from '@mui/material'
import { normalizeDraft, validateDraft, type FlatDraft } from '../domain/flat'
import { describeDraftError } from './draftMessages'
import { useTranslation } from '../i18n/useTranslation'

interface CreateFlatFormProps {
  initialStartDate: string
  busy: boolean
  submitError: string | null
  onSubmit: (draft: FlatDraft, ownerName: string) => void
  onBack: () => void
}

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
  const [name, setName] = useState('')
  const [members, setMembers] = useState(['', ''])
  const [zones, setZones] = useState(() => t('create.suggestedZones').split('|'))
  const [startDate, setStartDate] = useState(initialStartDate)
  // Index of the member row that is the person creating the flat
  const [ownerIndex, setOwnerIndex] = useState(0)
  const [errors, setErrors] = useState<string[]>([])

  const submit = () => {
    const draft = normalizeDraft({ name, members, zones, startDate })
    const ownerName = normalizeDraft({
      name,
      members: [members[ownerIndex] ?? ''],
      zones,
      startDate,
    }).members[0]
    const found = validateDraft(draft)
    const problems = ownerName ? found : [...found, 'owner-required']
    setErrors(problems)
    if (problems.length === 0) onSubmit(draft, ownerName)
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h5">{t('create.title')}</Typography>

      <TextField
        label={t('create.flatName')}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />

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

      <TextField
        type="date"
        label={t('create.start')}
        value={startDate}
        onChange={(event) => setStartDate(event.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
      />

      {errors.length > 0 ? (
        <Alert severity="error">
          {errors.map((code) => (
            <div key={code}>{describeDraftError(code)}</div>
          ))}
        </Alert>
      ) : null}
      {submitError ? <Alert severity="error">{submitError}</Alert> : null}

      <Stack direction="row" spacing={1}>
        <Button onClick={onBack}>{t('common.back')}</Button>
        <Button variant="contained" disabled={busy} onClick={submit}>
          {busy ? t('create.creating') : t('create.submit')}
        </Button>
      </Stack>
    </Stack>
  )
}
