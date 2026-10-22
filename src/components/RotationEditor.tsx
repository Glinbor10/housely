import { useState } from 'react'
import { Alert, Button, Stack, TextField, Typography } from '@mui/material'
import type { RotationEdit } from '../domain/rotationEdit'
import { useTranslation } from '../i18n/useTranslation'
import { describeDraftError } from './draftMessages'

interface PersonRow {
  // Missing for a person who is being added
  id?: string
  name: string
}

interface RotationEditorProps {
  // The people in rotation order, and the zones, as they are now
  people: Array<{ id: string; name: string }>
  zones: string[]
  // False when every id of the flat has been used: nobody else can be added
  canAddPeople: boolean
  // Monday the change starts to apply (YYYY-MM-DD)
  appliesFrom: string
  // Validation problems of the last attempt, as error codes
  problems: string[]
  busy: boolean
  error: string | null
  onSave: (edit: RotationEdit) => void
  onCancel: () => void
}

const replaceAt = <T,>(items: T[], index: number, value: T): T[] =>
  items.map((item, position) => (position === index ? value : item))

const removeAt = <T,>(items: T[], index: number): T[] =>
  items.filter((_, position) => position !== index)

// The owner edits who is in the rotation and which zones there are. Nothing changes until it is
// saved, and the change applies from next week, so the weeks already lived are never rewritten.
export const RotationEditor = ({
  people,
  zones,
  canAddPeople,
  appliesFrom,
  problems,
  busy,
  error,
  onSave,
  onCancel,
}: RotationEditorProps) => {
  const { t } = useTranslation()
  const [rows, setRows] = useState<PersonRow[]>(people)
  const [zoneNames, setZoneNames] = useState(zones)

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h6" component="h2">
          {t('rotation.title')}
        </Typography>
        <Alert severity="info">{t('rotation.appliesFrom', { date: appliesFrom })}</Alert>
      </Stack>

      <Stack spacing={1}>
        <Typography variant="subtitle1">{t('create.people')}</Typography>
        {rows.map((row, index) => (
          <Stack key={row.id ?? `new-${index}`} direction="row" spacing={1}>
            <TextField
              fullWidth
              size="small"
              label={t('create.person', { n: index + 1 })}
              value={row.name}
              onChange={(event) =>
                setRows(replaceAt(rows, index, { ...row, name: event.target.value }))
              }
            />
            <Button
              aria-label={t('create.removePerson', { n: index + 1 })}
              onClick={() => setRows(removeAt(rows, index))}
            >
              {t('common.remove')}
            </Button>
          </Stack>
        ))}
        <Button disabled={!canAddPeople} onClick={() => setRows([...rows, { name: '' }])}>
          {t('create.addPerson')}
        </Button>
        {!canAddPeople ? (
          <Typography variant="caption" color="text.secondary">
            {t('rotation.limitReached')}
          </Typography>
        ) : null}
      </Stack>

      <Stack spacing={1}>
        <Typography variant="subtitle1">{t('create.zones')}</Typography>
        {zoneNames.map((zone, index) => (
          <Stack key={index} direction="row" spacing={1}>
            <TextField
              fullWidth
              size="small"
              label={t('create.zone', { n: index + 1 })}
              value={zone}
              onChange={(event) => setZoneNames(replaceAt(zoneNames, index, event.target.value))}
            />
            <Button
              aria-label={t('create.removeZone', { n: index + 1 })}
              onClick={() => setZoneNames(removeAt(zoneNames, index))}
            >
              {t('common.remove')}
            </Button>
          </Stack>
        ))}
        <Button onClick={() => setZoneNames([...zoneNames, ''])}>{t('create.addZone')}</Button>
      </Stack>

      {problems.length > 0 ? (
        <Alert severity="error">
          {problems.map((code) => (
            <div key={code}>{describeDraftError(code)}</div>
          ))}
        </Alert>
      ) : null}
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Stack direction="row" spacing={1}>
        <Button onClick={onCancel}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          disabled={busy}
          onClick={() => onSave({ people: rows, zones: zoneNames })}
        >
          {busy ? t('common.saving') : t('common.save')}
        </Button>
      </Stack>
    </Stack>
  )
}
