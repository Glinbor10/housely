import { useState } from 'react'
import { Alert, Button, Stack, TextField, Typography } from '@mui/material'
import { useTranslation } from '../i18n/useTranslation'
import { ColorPicker } from './ColorPicker'

interface Candidate {
  id: string
  name: string
  // The color the person has now: it is the one they keep if they do not choose another
  color: string
}

interface JoinFlatProps {
  // Null until the invite code has been resolved; then the names nobody has claimed yet
  candidates: Candidate[] | null
  // The colors the people who are already in the flat have, with their name
  takenBy?: Record<string, string>
  // The name of the flat the invite code belongs to, once it is known
  flatName?: string
  busy: boolean
  error: string | null
  onFind: (code: string) => void
  onPick: (memberId: string, color: string) => void
  onBack: () => void
}

export const JoinFlat = ({
  candidates,
  takenBy = {},
  flatName,
  busy,
  error,
  onFind,
  onPick,
  onBack,
}: JoinFlatProps) => {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  // The person who has been chosen, and the color they want, before they join
  const [chosen, setChosen] = useState<Candidate | null>(null)
  const [color, setColor] = useState('')

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
          <Typography>{chosen === null ? t('join.who') : t('join.color')}</Typography>
          {chosen !== null ? (
            <Stack spacing={2}>
              <ColorPicker
                value={color}
                takenBy={takenBy}
                busy={busy}
                onChange={(hex) => setColor(hex)}
              />
              {error ? <Alert severity="error">{error}</Alert> : null}
              <Stack direction="row" spacing={1}>
                <Button onClick={() => setChosen(null)}>{t('common.back')}</Button>
                <Button
                  variant="contained"
                  disabled={busy}
                  onClick={() => onPick(chosen.id, color)}
                >
                  {t('join.submit')}
                </Button>
              </Stack>
            </Stack>
          ) : candidates.length === 0 ? (
            <Alert severity="warning">{t('join.allTaken')}</Alert>
          ) : (
            <Stack spacing={1}>
              {candidates.map((candidate) => (
                <Button
                  key={candidate.id}
                  variant="outlined"
                  disabled={busy}
                  onClick={() => {
                    setChosen(candidate)
                    setColor(candidate.color)
                  }}
                >
                  {candidate.name}
                </Button>
              ))}
            </Stack>
          )}
          {chosen === null ? (
            <>
              {error ? <Alert severity="error">{error}</Alert> : null}
              <Button sx={{ alignSelf: 'flex-start' }} onClick={onBack}>
                {t('common.back')}
              </Button>
            </>
          ) : null}
        </>
      )}
    </Stack>
  )
}
