import { useState } from 'react'
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { findCompletion, type Completion } from '../domain/completions'
import type { Assignment } from '../domain/rotation'
import { useTranslation } from '../i18n/useTranslation'

interface ThisWeekProps {
  weekIndex: number
  assignments: Assignment[]
  completions: Completion[]
  currentMember: string
  today: string
  // Color of each person by name; people without one get the brand color
  colors?: Record<string, string>
  onMarkDone: (entry: Completion) => void
}

export const ThisWeek = ({
  weekIndex,
  assignments,
  completions,
  currentMember,
  today,
  colors = {},
  onMarkDone,
}: ThisWeekProps) => {
  const { t } = useTranslation()
  // Draft dates per zone; a zone without a draft defaults to today.
  const [dates, setDates] = useState<Record<string, string>>({})
  const done = assignments.filter(({ zone }) => findCompletion(completions, weekIndex, zone)).length
  const percentage = assignments.length === 0 ? 0 : Math.round((done / assignments.length) * 100)

  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="body2" color="text.secondary">
          {t('week.zonesDone', { done, total: assignments.length })}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={percentage}
          color={percentage === 100 ? 'success' : 'primary'}
          aria-label={t('week.progress')}
          sx={{ height: 8, borderRadius: 4 }}
        />
        {percentage === 100 && assignments.length > 0 ? (
          <Typography variant="body2" color="success.main">
            {t('week.allClean')}
          </Typography>
        ) : null}
      </Stack>
      {assignments.map(({ zone, member }) => {
        const completion = findCompletion(completions, weekIndex, zone)
        const isMine = member === currentMember
        return (
          <Card
            key={zone}
            variant="outlined"
            sx={{ borderColor: isMine ? 'primary.main' : undefined, borderWidth: isMine ? 2 : 1 }}
          >
            <CardContent>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Avatar aria-hidden="true" sx={{ bgcolor: colors[member] ?? '#1976d2' }}>
                  {member.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h6">{zone}</Typography>
                  <Typography color="text.secondary">
                    {isMine ? t('common.you', { name: member }) : member}
                  </Typography>
                </Box>
                {completion ? (
                  <Chip color="success" label={t('week.done', { date: completion.doneAt })} />
                ) : (
                  <Chip label={t('week.pending')} />
                )}
              </Stack>
              {isMine ? (
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <TextField
                    type="date"
                    size="small"
                    value={dates[zone] ?? today}
                    onChange={(event) => setDates({ ...dates, [zone]: event.target.value })}
                  />
                  <Button
                    variant="contained"
                    onClick={() =>
                      onMarkDone({ weekIndex, zone, member, doneAt: dates[zone] ?? today })
                    }
                  >
                    {completion ? t('week.updateDate') : t('week.markDone')}
                  </Button>
                </Stack>
              ) : null}
            </CardContent>
          </Card>
        )
      })}
    </Stack>
  )
}
