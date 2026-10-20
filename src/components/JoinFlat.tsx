import { useState } from 'react'
import { Alert, Button, Stack, TextField, Typography } from '@mui/material'
import { useTranslation } from '../i18n/useTranslation'

interface Candidate {
  id: string
  name: string
}

interface JoinFlatProps {
  // Null until the invite code has been resolved; then the names nobody has claimed yet
  candidates: Candidate[] | null
  // The name of the flat the invite code belongs to, once it is known
  flatName?: string
  busy: boolean
  error: string | null
  onFind: (code: string) => void
  onPick: (memberId: string) => void
  onBack: () => void
}

export const JoinFlat = ({
  candidates,
  flatName,
  busy,
  error,
  onFind,
  onPick,
  onBack,
}: JoinFlatProps) => {
  const { t } = useTranslation()
  const [code, setCode] = useState('')

  return (
    <Stack spacing={3}>
      <Typography variant="h5">{t('join.title')}</Typography>

      {candidates === null ? (
        <>
          <Typography color="text.secondary">{t('join.ask')}</Typography>
          <TextField
            label={t('join.code')}
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Stack direction="row" spacing={1}>
            <Button onClick={onBack}>{t('common.back')}</Button>
            <Button
              variant="contained"
              disabled={busy}
              onClick={() => (code.trim() ? onFind(code) : undefined)}
            >
              {busy ? t('join.searching') : t('join.continue')}
            </Button>
          </Stack>
        </>
      ) : (
        <>
          {flatName ? (
            <Typography variant="h6">{t('join.joining', { name: flatName })}</Typography>
          ) : null}
          <Typography>{t('join.who')}</Typography>
          {candidates.length === 0 ? (
            <Alert severity="warning">{t('join.allTaken')}</Alert>
          ) : (
            <Stack spacing={1}>
              {candidates.map((candidate) => (
                <Button
                  key={candidate.id}
                  variant="outlined"
                  disabled={busy}
                  onClick={() => onPick(candidate.id)}
                >
                  {candidate.name}
                </Button>
              ))}
            </Stack>
          )}
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Button onClick={onBack}>{t('common.back')}</Button>
        </>
      )}
    </Stack>
  )
}
