import { useState } from 'react'
import { Alert, Button, Stack, TextField, Typography } from '@mui/material'
import { parseTricountUrl } from '../domain/tricount'
import { useTranslation } from '../i18n/useTranslation'
import { ExternalLinkIcon } from './icons'

interface TricountLinkProps {
  url: string | undefined
  // Only the owner of the flat can change the link (enforced by the Firestore rules too)
  canEdit: boolean
  busy: boolean
  error: string | null
  onSave: (url: string | null) => void
}

// A small, quiet link for the flats that still keep their expenses in Tricount: the expenses of the app
// come first. It never takes the logo or the colors of Tricount (its terms do not allow it): it is a text
// button of the app, and the icon and the line below say that it opens the Tricount app.
export const TricountLink = ({ url, canEdit, busy, error, onSave }: TricountLinkProps) => {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(url ?? '')
  const [problem, setProblem] = useState<string | null>(null)

  const save = () => {
    const parsed = parseTricountUrl(value)
    if (parsed.ok) {
      setProblem(null)
      onSave(parsed.url)
    } else {
      setProblem(t(`tricount.${parsed.reason}`))
    }
  }

  return (
    <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
      {url ? (
        <>
          <Button
            size="small"
            component="a"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<ExternalLinkIcon aria-hidden="true" />}
          >
            {t('tricount.open')}
          </Button>
          <Typography variant="caption" color="text.secondary">
            {t('tricount.opensApp')}
          </Typography>
        </>
      ) : null}

      {canEdit && !editing ? (
        <Button size="small" onClick={() => setEditing(true)}>
          {url ? t('tricount.edit') : t('tricount.add')}
        </Button>
      ) : null}

      {canEdit && editing ? (
        <Stack spacing={1} sx={{ width: '100%' }}>
          <TextField
            size="small"
            label={t('tricount.label')}
            helperText={t('tricount.help')}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          {problem ? <Alert severity="error">{problem}</Alert> : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Stack direction="row" spacing={1}>
            <Button onClick={() => setEditing(false)}>{t('common.cancel')}</Button>
            <Button variant="contained" disabled={busy} onClick={save}>
              {busy ? t('common.saving') : t('common.save')}
            </Button>
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  )
}
