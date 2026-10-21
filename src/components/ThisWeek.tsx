import { useState } from 'react'
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { m } from 'motion/react'
import { findCompletion, type Completion } from '../domain/completions'
import { getWeekMood } from '../domain/mood'
import type { Assignment } from '../domain/rotation'
import { useTranslation } from '../i18n/useTranslation'
import { Mascot } from './Mascot'
import { ProgressRing } from './ProgressRing'

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
  const complete = assignments.length > 0 && done === assignments.length

  return (
    <Stack spacing={2}>
      <Card
        sx={{
          background: (theme) =>
            `linear-gradient(135deg, ${theme.palette.primary.main}22, ${theme.palette.secondary.main}22)`,
        }}
      >
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Mascot mood={getWeekMood(done, assignments.length)} size={84} />
            <Stack spacing={0.5} sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="body2" color="text.secondary">
                {t('week.zonesDone', { done, total: assignments.length })}
              </Typography>
              {complete ? (
                <Typography variant="subtitle1" color="success.main" sx={{ fontWeight: 800 }}>
                  {t('week.allClean')}
                </Typography>
              ) : null}
            </Stack>
            <ProgressRing done={done} total={assignments.length} size={88} />
          </Stack>
        </CardContent>
      </Card>
      {assignments.map(({ zone, member }, index) => {
        const completion = findCompletion(completions, weekIndex, zone)
        const isMine = member === currentMember
        return (
          <m.div
            key={zone}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24, delay: index * 0.06 }}
          >
            <Card
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
                      slotProps={{ htmlInput: { 'aria-label': t('week.doneDate', { zone }) } }}
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
          </m.div>
        )
      })}
    </Stack>
  )
}
