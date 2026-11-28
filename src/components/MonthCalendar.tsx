import { UNKNOWN_PERSON_COLOR } from '../domain/palette'
import { MIN_TOUCH_TARGET, SIZE } from '../theme'
import { useState } from 'react'
import { alpha } from '@mui/material/styles'
import { Box, Button, IconButton, Stack, Typography } from '@mui/material'
import { buildMonth, shiftMonth, type CalendarCompletion, type YearMonth } from '../domain/calendar'
import { readableOn } from '../domain/color'
import { rotationWeekStart, weekEndDate } from '../domain/history'
import { useTranslation } from '../i18n/useTranslation'

interface Person {
  name: string
  color: string
}

interface MonthCalendarProps {
  completions: CalendarCompletion[]
  // Name and color of each person by id
  people: Record<string, Person>
  // Local calendar date of today, YYYY-MM-DD
  today: string
  // Start of the rotation, YYYY-MM-DD: the week of the cleaning cycle that today is in is shaded, and
  // that week starts on this day of the week, not on Monday. Without it the row of today is shaded.
  rotationStart?: string
  // When true, only shade the current rotation week; skip alternating tints for other weeks.
  currentWeekOnly?: boolean
}

const MAX_MARKS = 3

const initialOf = (name: string): string => name.trim().charAt(0).toUpperCase()

// Built from the parts of the date, never from a string, so a timezone can never move it to another day
const dateOf = (iso: string): Date => {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const monthOf = (iso: string): YearMonth => {
  const date = dateOf(iso)
  return { year: date.getFullYear(), month: date.getMonth() }
}

// The cleanings of the month on a calendar: each person has a color, and the day shows who cleaned
// and what. The initial is drawn inside the color, so the colors are never the only clue.
export const MonthCalendar = ({
  completions,
  people,
  today,
  rotationStart,
  currentWeekOnly = false,
}: MonthCalendarProps) => {
  const { t, locale } = useTranslation()
  const [shown, setShown] = useState<YearMonth>(() => monthOf(today))
  const [selected, setSelected] = useState<string | null>(null)

  const month = buildMonth({ ...shown, completions, today })
  const title = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(shown.year, shown.month, 1),
  )
  // 2024-01-01 was a Monday: seven days from it are the week in order
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 1 + index)),
  )
  const longDate = (iso: string): string =>
    new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(
      dateOf(iso),
    )
  const person = (id: string): Person => people[id] ?? { name: '?', color: UNKNOWN_PERSON_COLOR }
  const describe = (entries: { memberId: string; zone: string }[]): string =>
    entries.map((entry) => `${person(entry.memberId).name} (${entry.zone})`).join(', ')
  const detail = month.weeks.flat().find((day) => day.date === selected)
  const currentCycle = rotationStart ? rotationWeekStart(rotationStart, today) : null
  const currentCycleEnd = currentCycle ? weekEndDate(currentCycle, 0) : null

  // Rotation week index for a date, used to alternate week band tints
  const rotationWeekIdx = (date: string): number | null => {
    if (!rotationStart) return null
    const ws = rotationWeekStart(rotationStart, date)
    if (!ws) return null
    const [sy, sm, sd] = rotationStart.split('-').map(Number)
    const [wy, wm, wd] = ws.split('-').map(Number)
    return Math.round((Date.UTC(wy, wm - 1, wd) - Date.UTC(sy, sm - 1, sd)) / 86_400_000) / 7
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ alignItems: 'center' }}>
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
          variant="h6"
          component="h2"
          sx={{
            flexGrow: 1,
            textAlign: 'center',
            // One line, a little smaller on phones: "Noviembre de 2026" does not fit beside the arrows at 360 px
            whiteSpace: 'nowrap',
            fontSize: { xs: '1.05rem', sm: '1.25rem' },
            '&::first-letter': { textTransform: 'uppercase' },
          }}
        >
          {title}
        </Typography>
        <Button size="small" onClick={() => setShown(monthOf(today))}>
          {t('calendar.today')}
        </Button>
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
          {month.weeks.map((week) => (
            <Box
              key={week[0].date}
              component="tr"
              sx={
                !rotationStart && week.some((d) => d.isToday)
                  ? {
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14),
                      borderRadius: 2,
                    }
                  : undefined
              }
            >
              {week.map((day) => {
                // Current rotation week: strong tint; alternating even/odd for other weeks
                const rotIdx = currentWeekOnly ? null : rotationWeekIdx(day.date)
                const inCycle =
                  currentCycle !== null &&
                  currentCycleEnd !== null &&
                  day.date >= currentCycle &&
                  day.date <= currentCycleEnd
                // Band rounded corners: for all weeks when alternating, only current when currentWeekOnly
                const dayRotStart =
                  !currentWeekOnly && rotationStart
                    ? rotationWeekStart(rotationStart, day.date)
                    : null
                const dayRotEnd = dayRotStart ? weekEndDate(dayRotStart, 0) : null
                const bandStart = inCycle ? day.date === currentCycle : day.date === dayRotStart
                const bandEnd = inCycle ? day.date === currentCycleEnd : day.date === dayRotEnd
                const hasAnyBand = inCycle || rotIdx !== null
                const label =
                  day.entries.length > 0
                    ? `${longDate(day.date)}: ${describe(day.entries)}`
                    : longDate(day.date)
                return (
                  <Box
                    key={day.date}
                    component="td"
                    sx={{
                      p: 0.25,
                      verticalAlign: 'top',
                      bgcolor: inCycle
                        ? (theme) => alpha(theme.palette.primary.main, 0.14)
                        : rotIdx !== null && rotIdx % 2 === 0
                          ? (theme) => alpha(theme.palette.primary.main, 0.07)
                          : rotIdx !== null
                            ? (theme) => alpha(theme.palette.primary.main, 0.03)
                            : 'transparent',
                      borderTopLeftRadius: hasAnyBand && bandStart ? 16 : 0,
                      borderBottomLeftRadius: hasAnyBand && bandStart ? 16 : 0,
                      borderTopRightRadius: hasAnyBand && bandEnd ? 16 : 0,
                      borderBottomRightRadius: hasAnyBand && bandEnd ? 16 : 0,
                      // A thin gap where the week begins and ends: the next week does not run into it
                      borderLeft: hasAnyBand && bandStart ? '2px solid transparent' : 0,
                      borderRight: hasAnyBand && bandEnd ? '2px solid transparent' : 0,
                      backgroundClip: 'padding-box',
                    }}
                  >
                    <Box
                      component="button"
                      type="button"
                      aria-label={label}
                      aria-pressed={selected === day.date}
                      onClick={() => setSelected(day.date)}
                      sx={{
                        width: '100%',
                        minHeight: 48,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 0.25,
                        p: 0.5,
                        border: 2,
                        borderColor:
                          day.isToday || selected === day.date ? 'primary.main' : 'transparent',
                        borderRadius: 3,
                        bgcolor: 'transparent',
                        color: day.inMonth ? 'text.primary' : 'text.secondary',
                        font: 'inherit',
                        cursor: 'pointer',
                      }}
                    >
                      <Box
                        component="span"
                        aria-hidden="true"
                        sx={{ fontSize: 13, fontWeight: day.isToday ? 800 : 500 }}
                      >
                        {dateOf(day.date).getDate()}
                      </Box>
                      <Box
                        aria-hidden="true"
                        sx={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '2px',
                          justifyContent: 'center',
                        }}
                      >
                        {day.entries.slice(0, MAX_MARKS).map((entry, index) => {
                          const { name, color } = person(entry.memberId)
                          return (
                            <Box
                              key={index}
                              component="span"
                              sx={{
                                width: SIZE.mark,
                                height: SIZE.mark,
                                borderRadius: '50%',
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: 10,
                                fontWeight: 800,
                                bgcolor: color,
                                color: readableOn(color),
                              }}
                            >
                              {initialOf(name)}
                            </Box>
                          )
                        })}
                        {day.entries.length > MAX_MARKS ? (
                          <Box component="span" sx={{ fontSize: 10, fontWeight: 800 }}>
                            {`+${day.entries.length - MAX_MARKS}`}
                          </Box>
                        ) : null}
                      </Box>
                    </Box>
                  </Box>
                )
              })}
            </Box>
          ))}
        </Box>
      </Box>

      {detail ? (
        <Stack component="section" role="region" aria-label={longDate(detail.date)} spacing={1}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            {longDate(detail.date)}
          </Typography>
          {detail.entries.length === 0 ? (
            <Typography color="text.secondary">
              {t(detail.date > today ? 'calendar.future' : 'calendar.none')}
            </Typography>
          ) : (
            detail.entries.map((entry, index) => (
              <Stack key={index} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Box
                  aria-hidden="true"
                  sx={{
                    width: SIZE.dot,
                    height: SIZE.dot,
                    borderRadius: '50%',
                    bgcolor: person(entry.memberId).color,
                  }}
                />
                <Typography>
                  {t('calendar.entry', { name: person(entry.memberId).name, zone: entry.zone })}
                </Typography>
              </Stack>
            ))
          )}
        </Stack>
      ) : null}

      <Stack
        component="ul"
        aria-label={t('calendar.people')}
        direction="row"
        spacing={2}
        sx={{ listStyle: 'none', p: 0, m: 0, flexWrap: 'wrap', rowGap: 1 }}
      >
        {Object.entries(people).map(([id, { name, color }]) => (
          <Stack
            key={id}
            component="li"
            direction="row"
            spacing={0.75}
            sx={{ alignItems: 'center' }}
          >
            <Box
              aria-hidden="true"
              sx={{ width: SIZE.dot, height: SIZE.dot, borderRadius: '50%', bgcolor: color }}
            />
            <Typography variant="body2">{name}</Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  )
}
