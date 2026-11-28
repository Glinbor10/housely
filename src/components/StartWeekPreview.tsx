import { MIN_TOUCH_TARGET } from '../theme'
import { useState } from 'react'
import { alpha } from '@mui/material/styles'
import { Box, IconButton, Stack, Typography } from '@mui/material'
import { buildMonth, shiftMonth, type YearMonth } from '../domain/calendar'
import { formatDay } from '../domain/dates'
import { weekEndDate, weekStartDate } from '../domain/history'
import { useTranslation } from '../i18n/useTranslation'

interface StartWeekPreviewProps {
  // Start of the rotation, YYYY-MM-DD (may be empty or invalid while the person types)
  value: string
  onChange: (iso: string) => void
}

const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/

// Built from the parts of the date, never from a string, so a timezone can never move it to another day
const dateOf = (iso: string): Date => {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const monthOf = (iso: string): YearMonth => {
  const date = dateOf(iso)
  return { year: date.getFullYear(), month: date.getMonth() }
}

// A month calendar that shows how the rotation will go: the first week (from the chosen day, seven
// days) is shaded and the day the second week starts is ringed. Tapping a day chooses it as the start.
export const StartWeekPreview = ({ value, onChange }: StartWeekPreviewProps) => {
  const { t, locale } = useTranslation()
  const valid = VALID_DATE.test(value)
  const [shown, setShown] = useState<YearMonth>(() =>
    valid ? monthOf(value) : monthOf(new Date().toISOString().slice(0, 10)),
  )

  const firstEnd = valid ? weekEndDate(value, 0) : ''
  const nextStart = valid ? weekStartDate(value, 1) : ''
  const month = buildMonth({ ...shown, completions: [], today: '' })
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

  // The dates of the sentence are told apart so they can be shown in bold
  const dates: Record<string, string> = valid
    ? {
        from: formatDay(value, locale),
        to: formatDay(firstEnd, locale),
        next: formatDay(nextStart, locale),
      }
    : {}
  const hint = t('create.startPreviewHint', {
    from: '|from|',
    to: '|to|',
    next: '|next|',
  })
    .split(/\|(from|to|next)\|/)
    .filter((part) => part !== '')

  return (
    <Stack spacing={1} role="group" aria-label={t('create.start')}>
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
          variant="subtitle1"
          component="h3"
          sx={{
            flexGrow: 1,
            textAlign: 'center',
            fontWeight: 700,
            '&::first-letter': { textTransform: 'uppercase' },
          }}
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
          {month.weeks.map((week, rowIdx) => (
            <Box key={week[0].date} component="tr">
              {week.map((day) => {
                const inFirstWeek = valid && day.date >= value && day.date <= firstEnd
                const isStart = valid && day.date === value
                const isNextStart = valid && day.date === nextStart
                // The shading is one band: rounded where the week begins or ends, and at the edges of a row
                const bandStart = isStart
                const bandEnd = day.date === firstEnd
                // Alternating row tints help distinguish calendar weeks visually
                const rowTint = rowIdx % 2 === 0 ? 0.06 : 0.02
                return (
                  <Box
                    key={day.date}
                    component="td"
                    sx={{
                      p: 0,
                      verticalAlign: 'middle',
                      bgcolor: inFirstWeek
                        ? (theme) => alpha(theme.palette.primary.main, 0.16)
                        : (theme) => alpha(theme.palette.primary.main, rowTint),
                      borderTopLeftRadius: inFirstWeek && bandStart ? 24 : 0,
                      borderBottomLeftRadius: inFirstWeek && bandStart ? 24 : 0,
                      borderTopRightRadius: inFirstWeek && bandEnd ? 24 : 0,
                      borderBottomRightRadius: inFirstWeek && bandEnd ? 24 : 0,
                      // A thin gap where the week begins and ends: the next week does not run into it
                      borderLeft: inFirstWeek && bandStart ? '2px solid transparent' : 0,
                      borderRight: inFirstWeek && bandEnd ? '2px solid transparent' : 0,
                      backgroundClip: 'padding-box',
                    }}
                  >
                    <Box
                      component="button"
                      type="button"
                      aria-label={longDate(day.date)}
                      aria-pressed={isStart}
                      data-date={day.date}
                      onClick={() => onChange(day.date)}
                      sx={{
                        width: '100%',
                        minHeight: 44,
                        display: 'grid',
                        placeItems: 'center',
                        p: 0,
                        border: 2,
                        borderStyle: isNextStart ? 'dashed' : 'solid',
                        borderColor: isStart || isNextStart ? 'primary.main' : 'transparent',
                        borderRadius: 6,
                        bgcolor: isStart ? 'primary.main' : 'transparent',
                        color: isStart
                          ? 'primary.contrastText'
                          : day.inMonth
                            ? 'text.primary'
                            : 'text.secondary',
                        fontSize: 13,
                        fontWeight: isStart || isNextStart ? 800 : 500,
                        font: 'inherit',
                        cursor: 'pointer',
                      }}
                    >
                      <Box component="span" aria-hidden="true">
                        {dateOf(day.date).getDate()}
                      </Box>
                    </Box>
                  </Box>
                )
              })}
            </Box>
          ))}
        </Box>
      </Box>

      <Typography variant="body2" color="text.secondary">
        {valid
          ? hint.map((part, index) =>
              part in dates ? (
                <Box key={index} component="strong" sx={{ color: 'text.primary' }}>
                  {dates[part]}
                </Box>
              ) : (
                part
              ),
            )
          : t('create.startPreviewEmpty')}
      </Typography>
    </Stack>
  )
}
