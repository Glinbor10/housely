import { useState } from 'react'
import { Box, ButtonBase, Card, Stack, Typography } from '@mui/material'
import { AnimatePresence, m } from 'motion/react'
import { formatDay } from '../domain/dates'
import { useTranslation } from '../i18n/useTranslation'
import { MIN_TOUCH_TARGET } from '../theme'
import { ChevronDownIcon } from './icons'
import { ZoneIcon } from './ZoneIcon'

export interface UpcomingWeek {
  // First and last day of the week, YYYY-MM-DD
  startsOn: string
  endsOn: string
  // The zones of the person that week: none means they rest
  zones: string[]
}

interface UpcomingWeeksProps {
  weeks: UpcomingWeek[]
}

// The next weeks of the person, closed at first: the Week tab already says what is next, and this is
// only for who wants to plan further.
export const UpcomingWeeks = ({ weeks }: UpcomingWeeksProps) => {
  const { t, locale } = useTranslation()
  const [open, setOpen] = useState(false)
  return weeks.length === 0 ? null : (
    <Card variant="outlined" component="section" aria-label={t('week.upcoming')}>
      <ButtonBase
        aria-expanded={open}
        aria-controls="upcoming-weeks"
        onClick={() => setOpen(!open)}
        sx={{
          width: '100%',
          minHeight: MIN_TOUCH_TARGET,
          px: 2,
          py: 1,
          justifyContent: 'space-between',
          textAlign: 'left',
        }}
      >
        <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 800 }}>
          {t('week.upcoming')}
        </Typography>
        <Box
          component={m.span}
          aria-hidden="true"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          sx={{ display: 'inline-flex', color: 'text.secondary' }}
        >
          <ChevronDownIcon />
        </Box>
      </ButtonBase>
      <AnimatePresence initial={false}>
        {open ? (
          <m.div
            key="weeks"
            id="upcoming-weeks"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <Stack spacing={1} sx={{ px: 2, pb: 2 }}>
              {weeks.map((week) => (
                <Stack
                  key={week.startsOn}
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {t('week.upcoming.dates', {
                      from: formatDay(week.startsOn, locale),
                      to: formatDay(week.endsOn, locale),
                    })}
                  </Typography>
                  {week.zones.length === 0 ? (
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {t('week.upcoming.rest')}
                    </Typography>
                  ) : (
                    <Stack
                      direction="row"
                      spacing={1.5}
                      sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}
                    >
                      {week.zones.map((zone) => (
                        <Stack
                          key={zone}
                          direction="row"
                          spacing={0.5}
                          sx={{ alignItems: 'center' }}
                        >
                          <ZoneIcon zone={zone} color="action" sx={{ fontSize: 16 }} />
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {zone}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </Stack>
              ))}
            </Stack>
          </m.div>
        ) : null}
      </AnimatePresence>
    </Card>
  )
}
