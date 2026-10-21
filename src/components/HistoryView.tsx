import { useState } from 'react'
import { Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material'
import type { HistoryWeek, PersonStats, ZoneStats } from '../domain/history'
import { useTranslation } from '../i18n/useTranslation'

interface HistoryViewProps {
  weeks: HistoryWeek[]
  // Name of each person by id
  names: Record<string, string>
  currentWeek: number
  people: PersonStats[]
  zones: ZoneStats[]
}

const WEEKS_SHOWN = 8

export const HistoryView = ({ weeks, names, currentWeek, people, zones }: HistoryViewProps) => {
  const { t } = useTranslation()
  const [shown, setShown] = useState(WEEKS_SHOWN)

  return weeks.length === 0 ? (
    <Typography color="text.secondary">{t('history.empty')}</Typography>
  ) : (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h6" component="h2">
          {t('history.byPerson')}
        </Typography>
        <Stack component="ul" spacing={1} sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {people.map((person) => (
            <Card
              key={person.memberId}
              component="li"
              variant="outlined"
              aria-label={names[person.memberId] ?? '?'}
            >
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Typography sx={{ flexGrow: 1, fontWeight: 700 }}>
                    {names[person.memberId] ?? '?'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('history.progress', { done: person.done, assigned: person.assigned })}
                  </Typography>
                  {person.missed > 0 ? (
                    <Chip
                      size="small"
                      color="warning"
                      label={t('history.missedCount', { n: person.missed })}
                    />
                  ) : null}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Stack>

      <Stack spacing={1}>
        <Typography variant="h6" component="h2">
          {t('history.byZone')}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {zones.map((zone) => (
            <Chip
              key={zone.zone}
              variant="outlined"
              label={`${zone.zone}: ${t('history.progress', { done: zone.done, assigned: zone.assigned })}`}
            />
          ))}
        </Box>
      </Stack>

      <Stack spacing={1}>
        <Typography variant="h6" component="h2">
          {t('history.weeks')}
        </Typography>
        {weeks.slice(0, shown).map((week) => (
          <Card key={week.weekIndex} variant="outlined">
            <CardContent>
              <Stack spacing={1}>
                <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 800 }}>
                  {t('history.weekOf', { n: week.weekIndex + 1, date: week.startsOn })}
                </Typography>
                {week.entries.map((entry) => (
                  <Stack
                    key={entry.zone}
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <Box>
                      <Typography>{entry.zone}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {names[entry.memberId] ?? '?'}
                      </Typography>
                    </Box>
                    {entry.doneAt !== null ? (
                      <Chip
                        size="small"
                        color="success"
                        label={t('week.done', { date: entry.doneAt })}
                      />
                    ) : week.weekIndex < currentWeek ? (
                      <Chip size="small" color="warning" label={t('history.missed')} />
                    ) : (
                      <Chip size="small" label={t('week.pending')} />
                    )}
                  </Stack>
                ))}
                {week.resting.length > 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {t('history.resting', {
                      names: week.resting.map((id) => names[id] ?? '?').join(', '),
                    })}
                  </Typography>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        ))}
        {shown < weeks.length ? (
          <Button onClick={() => setShown(shown + WEEKS_SHOWN)}>{t('history.showOlder')}</Button>
        ) : null}
      </Stack>
    </Stack>
  )
}
