import { useState } from 'react'
import { Container, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { markDone, toIsoDate, type Completion } from './domain/completions'
import { getAssignments, getWeekIndex } from './domain/rotation'
import { loadState, saveState, type AppState } from './storage/localState'
import { ThisWeek } from './components/ThisWeek'

const App = () => {
  const [state, setState] = useState<AppState>(loadState)
  // Captured once on mount: keeps render pure and the date stable while the screen is open.
  const [now] = useState(() => new Date())
  const { household, completions, currentMember } = state

  const weekIndex = getWeekIndex(new Date(`${household.startDate}T00:00:00`), now)
  const assignments = getAssignments(household.members, household.zones, weekIndex)

  // Persist inside the handler instead of an effect.
  const update = (next: AppState) => {
    saveState(next)
    setState(next)
  }

  return (
    <Container maxWidth="sm" sx={{ py: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h4">Housely</Typography>
        <Typography color="text.secondary">
          {household.name} · week {weekIndex + 1}
        </Typography>
        <TextField
          select
          size="small"
          label="I am"
          value={currentMember}
          onChange={(event) => update({ ...state, currentMember: event.target.value })}
        >
          {household.members.map((member) => (
            <MenuItem key={member} value={member}>
              {member}
            </MenuItem>
          ))}
        </TextField>
        <ThisWeek
          weekIndex={weekIndex}
          assignments={assignments}
          completions={completions}
          currentMember={currentMember}
          today={toIsoDate(now)}
          onMarkDone={(entry: Completion) =>
            update({ ...state, completions: markDone(completions, entry) })
          }
        />
      </Stack>
    </Container>
  )
}

export default App
