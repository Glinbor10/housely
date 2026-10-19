import { useState } from 'react'
import { Box, Button, Card, CardContent, Chip, Stack, TextField, Typography } from '@mui/material'
import { findCompletion, type Completion } from '../domain/completions'
import type { Assignment } from '../domain/rotation'

interface ThisWeekProps {
  weekIndex: number
  assignments: Assignment[]
  completions: Completion[]
  currentMember: string
  today: string
  onMarkDone: (entry: Completion) => void
}

export const ThisWeek = ({
  weekIndex,
  assignments,
  completions,
  currentMember,
  today,
  onMarkDone,
}: ThisWeekProps) => {
  // Draft dates per zone; a zone without a draft defaults to today.
  const [dates, setDates] = useState<Record<string, string>>({})

  return (
    <Stack spacing={2}>
      {assignments.map(({ zone, member }) => {
        const completion = findCompletion(completions, weekIndex, zone)
        const isMine = member === currentMember
        return (
          <Card
            key={zone}
            variant="outlined"
            sx={{ borderColor: isMine ? 'primary.main' : undefined }}
          >
            <CardContent>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h6">{zone}</Typography>
                  <Typography color="text.secondary">
                    {isMine ? `${member} (you)` : member}
                  </Typography>
                </Box>
                {completion ? (
                  <Chip color="success" label={`Done ${completion.doneAt}`} />
                ) : (
                  <Chip label="Pending" />
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
                    {completion ? 'Update date' : 'Mark as done'}
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
