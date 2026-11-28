import { MIN_TOUCH_TARGET } from '../theme'
import { useState } from 'react'
import { alpha } from '@mui/material/styles'
import { Box, IconButton, Stack, Typography } from '@mui/material'
import { CheckIcon } from './icons'
import { buildMonth, shiftMonth, type YearMonth } from '../domain/calendar'
import { weekEndDate } from '../domain/history'
import type { Takeable } from '../domain/takeovers'
import { useTranslation } from '../i18n/useTranslation'

// A cleaning that can be taken, with the first day of its week: people find a week on a calendar, they
// do not know which one is "week 4"
export type PickableCleaning = Takeable & { startsOn: string }

interface WeekCalendarProps {
  cleanings: PickableCleaning[]
  // Local calendar date of today, YYYY-MM-DD
  today: string
  // The week that is chosen, by its first day, or null
  selected: string | null
  // A day of a week with something to take was pressed: the week, by its first day
  onPick: (startsOn: string) => void
}

// Built from the parts of the date, never from a string, so a timezone can never move it to another day
const dateOf = (iso: string): Date => {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const monthOf = (iso: string): YearMonth => {
  const date = dateOf(iso)
  return { year: date.getFullYear(), month: date.getMonth() }
}

// The weeks that have something to take, on a month calendar: a day picks the whole week it is in. The
// cleanings of that week are chosen in the next step.
export const WeekCalendar = ({ cleanings, today, selected, onPick }: WeekCalendarProps) => {
  const { t, locale } = useTranslation()
  const offered = [...new Set(cleanings.map((item) => item.startsOn))].sort()
  const week = selected
  const [shown, setShown] = useState<YearMonth>(() => monthOf(offered[0] ?? today))

  const month = buildMonth({ ...shown, completions: [], today })
  const title = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(shown.year, shown.month, 1),
  )
  // 2024-01-01 was a Monday: seven days from it are the week in order
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 1 + index)),
  )
  const longDate = (iso: string): string =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(dateOf(iso))
  // A rotation week can start on any day, so it does not follow the rows of the calendar: each day
  // belongs to the week that starts at most six days before it
  const weekOfDay = (date: string): string | null =>
    offered.find((start) => date >= start && date <= weekEndDate(start, 0)) ?? null

  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        {t('settle.pick.hint')}
      </Typography>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton
          aria-label={t('calendar.previous')}
          sx={{ width: MIN_TOUCH_TARGET, flexShrink: 0 }}
          onClick={() => setShown(shiftMonth(shown, -1))}
        >
          <Box component="span" aria-hidden="true">
            ‹
          </Box>
        </IconButton>
        <Typography
          variant="subtitle1"
          component="h4"
          sx={{ fontWeight: 800, '&::first-letter': { textTransform: 'uppercase' } }}
        >
          {title}
        </Typography>
        <IconButton
          aria-label={t('calendar.next')}
          sx={{ width: MIN_TOUCH_TARGET, flexShrink: 0 }}
          onClick={() => setShown(shiftMonth(shown, 1))}
        >
          <Box component="span" aria-hidden="true">
            ›
          </Box>
        </IconButton>
      </Stack>

      <Box
        component="table"
        sx={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}
      >
        <Box component="thead">
          <Box component="tr">
            {weekdays.map((weekday) => (
              <Box
                key={weekday}
                component="th"
                scope="col"
                sx={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'text.secondary',
                  pb: 0.5,
                  textTransform: 'capitalize',
                }}
              >
                {weekday}
              </Box>
            ))}
          </Box>
        </Box>
        <Box component="tbody">
          {month.weeks.map((row) => (
            <Box key={row[0].date} component="tr">
              {row.map((day) => {
                const dayWeek = weekOfDay(day.date)
                const available = dayWeek !== null
                const selected = dayWeek !== null && dayWeek === week
                // One band per week: rounded where the week begins or ends and at the edges of a row
                const bandStart = dayWeek === day.date
                const bandEnd = dayWeek !== null && weekEndDate(dayWeek, 0) === day.date
                // Alternate tint by position in offered list so weeks are visually distinct
                const weekPos = dayWeek !== null ? offered.indexOf(dayWeek) : -1
                const tint = weekPos % 2 === 0 ? 0.14 : 0.07
                return (
                  <Box
                    key={day.date}
                    component="td"
                    sx={{
                      p: 0,
                      bgcolor: selected
                        ? 'primary.main'
                        : available
                          ? (theme) => alpha(theme.palette.primary.main, tint)
                          : 'transparent',
                      color: selected ? 'primary.contrastText' : 'text.primary',
                      borderTopLeftRadius: available && bandStart ? 24 : 0,
                      borderBottomLeftRadius: available && bandStart ? 24 : 0,
                      borderTopRightRadius: available && bandEnd ? 24 : 0,
                      borderBottomRightRadius: available && bandEnd ? 24 : 0,
                      // A thin gap where the week begins and ends: the next week does not run into it
                      borderLeft: available && bandStart ? '2px solid transparent' : 0,
                      borderRight: available && bandEnd ? '2px solid transparent' : 0,
                      backgroundClip: 'padding-box',
                    }}
                  >
                    <Box
                      component="button"
                      type="button"
                      disabled={!available}
                      aria-label={longDate(day.date)}
                      aria-pressed={selected}
                      onClick={() => dayWeek !== null && onPick(dayWeek)}
                      sx={{
                        position: 'relative',
                        width: '100%',
                        minHeight: MIN_TOUCH_TARGET,
                        border: 0,
                        bgcolor: 'transparent',
                        color: 'inherit',
                        font: 'inherit',
                        fontSize: 14,
                        fontWeight: available ? 800 : 400,
                        cursor: available ? 'pointer' : 'default',
                        opacity: day.inMonth || available ? 1 : 0.5,
                      }}
                    >
                      {dateOf(day.date).getDate()}
                      {selected && dayWeek === day.date ? (
                        // A tick on the first day of the week that was chosen
                        <CheckIcon
                          aria-hidden="true"
                          sx={{ position: 'absolute', top: 1, right: 1, fontSize: 12 }}
                        />
                      ) : null}
                    </Box>
                  </Box>
                )
              })}
            </Box>
          ))}
        </Box>
      </Box>
    </Stack>
  )
}
