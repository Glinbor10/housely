import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { parseTricountUrl } from '../domain/tricount'
import { useTranslation } from '../i18n/useTranslation'
import { ReceiptIcon } from './icons'

interface TricountLinkProps {
  url: string | undefined
  // Only the owner of the flat can change the link (enforced by the Firestore rules too)
  canEdit: boolean
  busy: boolean
  error: string | null
  onSave: (url: string | null) => void
}

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

  const shortcut = (hint: string) => (
    <CardContent>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <ReceiptIcon color="primary" sx={{ fontSize: 40 }} />
        <Box>
          <Typography variant="h6" component="span" sx={{ display: 'block' }}>
            Tricount
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {hint}
          </Typography>
        </Box>
      </Stack>
    </CardContent>
  )

  return (
    <Stack spacing={1}>
      {url ? (
        <Card
          component="a"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('tricount.open')}
          sx={{
            display: 'block',
            textDecoration: 'none',
            color: 'inherit',
            border: 1,
            borderColor: 'primary.main',
          }}
        >
          {shortcut(t('tricount.openHint'))}
        </Card>
      ) : canEdit ? (
        // No link yet: the shortcut is faded and invites the owner to add it
        <Card variant="outlined" sx={{ opacity: 0.5, borderStyle: 'dashed' }}>
          <CardActionArea aria-label={t('tricount.add')} onClick={() => setEditing(true)}>
            {shortcut(t('tricount.addHint'))}
          </CardActionArea>
        </Card>
      ) : (
        <Card variant="outlined" sx={{ opacity: 0.5, borderStyle: 'dashed' }}>
          {shortcut(t('tricount.notYet'))}
        </Card>
      )}

      {canEdit && !editing && url ? (
        <Button size="small" onClick={() => setEditing(true)}>
          {t('tricount.edit')}
        </Button>
      ) : null}

      {canEdit && editing ? (
        <Stack spacing={1}>
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
