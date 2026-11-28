import { UNKNOWN_PERSON_COLOR } from '../domain/palette'
import { MIN_TOUCH_TARGET, SIZE } from '../theme'
import { useState } from 'react'
import { alpha } from '@mui/material/styles'
import {
  Alert,
  Avatar,
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Popover,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { m } from 'motion/react'
import { readableOn } from '../domain/color'
import { findCompletion, type Completion } from '../domain/completions'
import { formatDay } from '../domain/dates'
import { weekEndDate } from '../domain/history'
import { getWeekMood, type Mood } from '../domain/mood'
import type { Assignment } from '../domain/rotation'
import { useTranslation } from '../i18n/useTranslation'
import { CheckIcon, EditIcon, MoonIcon, SwapIcon } from './icons'
import { Mascot } from './Mascot'
import { ShareButton } from './ShareButton'
import { UpcomingWeeks, type UpcomingWeek } from './UpcomingWeeks'
import { ZoneIcon } from './ZoneIcon'
import { useLayer, type LayerProps } from './useLayer'
import { ProgressRing } from './ProgressRing'

// A short line from Housy, in a bubble above it. The tail is a rotated square of the same color.
// Up to this many next zones show in the header card; the rest are behind a "+n" that opens them all
const MAX_NEXT_ZONES_SHOWN = 2
const NEXT_ZONES_LAYER = 'next-zones'

export type { UpcomingWeek }

// The ring of the week, when the person rests: a moon in the same size, because there is nothing to fill
const RestBadge = ({ label }: { label: string }) => (
  <Stack
    role="img"
    aria-label={label}
    sx={{
      width: 88,
      height: 88,
      flexShrink: 0,
      borderRadius: '50%',
      alignItems: 'center',
      justifyContent: 'center',
      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14),
      color: 'primary.main',
    }}
  >
    <MoonIcon aria-hidden="true" sx={{ fontSize: 36 }} />
    <Typography variant="caption" aria-hidden="true" sx={{ fontWeight: 800 }}>
      {label}
    </Typography>
  </Stack>
)

const MascotBubble = ({ text, onPress }: { text: string; onPress?: () => void }) => (
  <Box
    data-testid="mascot-bubble"
    component={onPress ? 'button' : 'div'}
    type={onPress ? 'button' : undefined}
    onClick={onPress}
    sx={{
      // A bubble that can be pressed looks like it: a pointer and an arrow after the text
      ...(onPress
        ? {
            cursor: 'pointer',
            font: 'inherit',
            textAlign: 'left',
            color: 'inherit',
            // The area to press reaches 44 px without making the bubble taller
            '&::before': { content: '""', position: 'absolute', inset: '-7px -4px' },
          }
        : {}),
      position: 'relative',
      width: 'fit-content',
      maxWidth: 260,
      bgcolor: 'background.paper',
      color: 'text.primary',
      border: 1,
      borderColor: 'divider',
      borderRadius: 2,
      // Room around the text: at 8 x 4 px it sat against the border and read as cramped
      px: 1.5,
      py: 1,
      boxShadow: 1,
      '&::after': {
        content: '""',
        position: 'absolute',
        bottom: -5,
        left: '2rem',
        width: 10,
        height: 10,
        bgcolor: 'background.paper',
        transform: 'rotate(45deg)',
      },
    }}
  >
    <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.4, display: 'block' }}>
      {text}
      {onPress ? ' ›' : ''}
    </Typography>
  </Box>
)

// Whether a zone is done: a green circle with a tick, or an empty ring when it is still to do. Red is not
// used for "to do": it reads as an error or as a destructive action, and the zone is just waiting. The
// label says it to whoever cannot see the shape.
const StatusBadge = ({ done, label }: { done: boolean; label: string }) => (
  <Box
    role="img"
    aria-label={label}
    data-status={done ? 'done' : 'pending'}
    sx={{
      width: MIN_TOUCH_TARGET,
      height: MIN_TOUCH_TARGET,
      boxSizing: 'border-box',
      flexShrink: 0,
      borderRadius: '50%',
      display: 'grid',
      placeItems: 'center',
      ...(done
        ? { bgcolor: 'success.main', color: 'success.contrastText' }
        : { border: 2, borderColor: 'text.secondary' }),
    }}
  >
    {done ? <CheckIcon /> : null}
  </Box>
)

interface ThisWeekProps extends LayerProps {
  weekIndex: number
  // First day of the current rotation week, YYYY-MM-DD
  startsOn: string
  assignments: Assignment[]
  completions: Completion[]
  currentMember: string
  today: string
  // Color of each person by name; people without one get the brand color
  colors?: Record<string, string>
  // How the mascot feels; without it the progress of the week decides
  mood?: Mood
  // A short line the mascot says, shown in a bubble above it
  mascotBubble?: string
  // When the bubble can be pressed (it tells of cleanings to settle), where it takes to
  onMascotBubble?: () => void
  // The zones that were taken from a flatmate, by zone: who had it and the week it settles
  takenFrom?: Record<string, { name: string; startsOn: string }>
  // The zones the current person has next week (one or more), to show a heads-up in the header card
  nextZones?: string[]
  // The person has no zone this week while others do: they rest
  resting?: boolean
  // The next weeks of the person: what they have each one, to know when their turn is
  upcoming?: UpcomingWeek[]
  onMarkDone: (entry: Completion) => void
  // Takes a cleaning back: the zone is pending again
  onUndoDone: (weekIndex: number, zone: string) => void
}

export const ThisWeek = ({
  weekIndex,
  startsOn,
  assignments,
  completions,
  currentMember,
  today,
  colors = {},
  mood,
  mascotBubble,
  onMascotBubble,
  takenFrom = {},
  nextZones = [],
  resting = false,
  upcoming = [],
  onMarkDone,
  onUndoDone,
  layer,
  onOpenLayer,
  onCloseLayer,
}: ThisWeekProps) => {
  const { t, locale } = useTranslation()
  // The dialog of the date and the undo of a zone (from the pencil) is a layer: the back button closes it.
  // The date that is being typed there is kept here.
  const layers = useLayer({ layer, onOpenLayer, onCloseLayer })
  const dateLayer = (zone: string) => `date:${zone}`
  const [dates, setDates] = useState<Record<string, string>>({})
  // The zone whose undo is waiting for a confirmation
  const [undoing, setUndoing] = useState<string | null>(null)
  // The zone shown in the "marked as done · undo" snackbar (null = hidden)
  const [snackZone, setSnackZone] = useState<string | null>(null)
  // The "+n" of the next zones: the bubble with all of them opens from there, and it is a layer too
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null)
  const hiddenNextZones = Math.max(0, nextZones.length - MAX_NEXT_ZONES_SHOWN)
  const shownNextZones = hiddenNextZones > 0 ? nextZones.slice(0, MAX_NEXT_ZONES_SHOWN) : nextZones
  const done = assignments.filter(({ zone }) => findCompletion(completions, weekIndex, zone)).length

  const shareMessage =
    assignments.length > 0
      ? [
          t('whatsapp.week.header', {
            start: formatDay(startsOn, locale),
            end: formatDay(weekEndDate(startsOn, 0), locale),
          }),
          '',
          ...assignments.map(({ zone, member }) => t('whatsapp.week.row', { zone, name: member })),
        ].join('\n')
      : ''

  return (
    <Stack spacing={2}>
      <Card
        sx={{
          background: (theme) =>
            `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.18)}, ${alpha(theme.palette.secondary.main, 0.1)})`,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <CardContent>
          {mascotBubble ? <MascotBubble text={mascotBubble} onPress={onMascotBubble} /> : null}
          <Stack
            direction="row"
            spacing={2}
            sx={{ alignItems: 'center', mt: mascotBubble ? 1 : 0 }}
          >
            <Mascot mood={mood ?? getWeekMood(done, assignments.length)} size={84} />
            {resting ? (
              <RestBadge label={t('week.restBadge')} />
            ) : (
              <ProgressRing done={done} total={assignments.length} size={88} />
            )}
            {nextZones.length > 0 ? (
              <Box
                sx={{
                  flexGrow: 1,
                  minWidth: 0,
                  pl: 2,
                  borderLeft: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {t(nextZones.length === 1 ? 'week.nextZoneLabel' : 'week.nextZonesLabel')}
                </Typography>
                {shownNextZones.map((zone) => (
                  <Stack key={zone} direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <ZoneIcon zone={zone} color="action" sx={{ fontSize: 16 }} />
                    <Typography variant="body2" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
                      {zone}
                    </Typography>
                  </Stack>
                ))}
                {hiddenNextZones > 0 ? (
                  <>
                    <ButtonBase
                      aria-label={t('week.nextZonesAll')}
                      aria-haspopup="dialog"
                      ref={setMoreAnchor}
                      aria-expanded={layers.current === NEXT_ZONES_LAYER}
                      onClick={() => layers.open(NEXT_ZONES_LAYER)}
                      sx={{
                        // The pill is small, the area to tap is not
                        minHeight: MIN_TOUCH_TARGET,
                        my: -1.25,
                        justifyContent: 'flex-start',
                      }}
                    >
                      <Box
                        component="span"
                        sx={{
                          px: 1,
                          borderRadius: 999,
                          typography: 'caption',
                          fontWeight: 800,
                          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.16),
                          color: 'primary.dark',
                        }}
                      >
                        {t('week.nextZonesMore', { n: hiddenNextZones })}
                      </Box>
                    </ButtonBase>
                    <Popover
                      open={layers.current === NEXT_ZONES_LAYER}
                      anchorEl={moreAnchor}
                      onClose={() => layers.close(NEXT_ZONES_LAYER)}
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                    >
                      <Stack spacing={1} sx={{ p: 2, maxHeight: '60dvh', overflowY: 'auto' }}>
                        <Typography variant="subtitle2">{t('week.nextZonesLabel')}</Typography>
                        {nextZones.map((zone) => (
                          <Stack
                            key={zone}
                            direction="row"
                            spacing={1}
                            sx={{ alignItems: 'center' }}
                          >
                            <ZoneIcon zone={zone} color="primary" fontSize="small" />
                            <Typography>{zone}</Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Popover>
                  </>
                ) : null}
              </Box>
            ) : null}
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
                  <Avatar
                    aria-hidden="true"
                    sx={{
                      bgcolor: colors[member] ?? UNKNOWN_PERSON_COLOR,
                      color: readableOn(colors[member] ?? UNKNOWN_PERSON_COLOR),
                    }}
                  >
                    {member.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <ZoneIcon zone={zone} color="primary" />
                      <Typography variant="h6" component="h2">
                        {zone}
                      </Typography>
                    </Stack>
                    <Typography color="text.secondary">
                      {isMine ? t('common.you', { name: member }) : member}
                    </Typography>
                    {takenFrom[zone] ? (
                      <Stack spacing={0.25} sx={{ alignItems: 'flex-start', pt: 0.5 }}>
                        <Chip
                          size="small"
                          variant="outlined"
                          icon={<SwapIcon />}
                          label={t('takeover.takenFrom', { name: takenFrom[zone].name })}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {t('takeover.makesUp', {
                            from: formatDay(takenFrom[zone].startsOn, locale),
                            to: formatDay(weekEndDate(takenFrom[zone].startsOn, 0), locale),
                          })}
                        </Typography>
                      </Stack>
                    ) : null}
                  </Box>
                  {isMine && completion ? (
                    <ButtonBase
                      aria-label={t('week.editAria', { zone })}
                      aria-expanded={layers.current === dateLayer(zone)}
                      onClick={() => {
                        if (layers.current === dateLayer(zone)) layers.close(dateLayer(zone))
                        else layers.open(dateLayer(zone))
                        setUndoing(null)
                      }}
                      sx={{ position: 'relative', borderRadius: '50%', flexShrink: 0 }}
                    >
                      <StatusBadge
                        done
                        label={t('week.done', { date: formatDay(completion.doneAt, locale) })}
                      />
                      <Box
                        aria-hidden="true"
                        sx={{
                          position: 'absolute',
                          right: -4,
                          bottom: -4,
                          width: SIZE.badge,
                          height: SIZE.badge,
                          borderRadius: '50%',
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: 'background.paper',
                          border: 1,
                          borderColor: 'divider',
                          color: 'text.primary',
                        }}
                      >
                        <EditIcon sx={{ fontSize: 14 }} />
                      </Box>
                    </ButtonBase>
                  ) : (
                    <StatusBadge
                      done={completion !== undefined}
                      label={
                        completion
                          ? t('week.done', { date: formatDay(completion.doneAt, locale) })
                          : t('week.pending')
                      }
                    />
                  )}
                </Stack>
                {isMine && !completion ? (
                  <Button
                    fullWidth
                    variant="contained"
                    sx={{ mt: 2 }}
                    onClick={() => {
                      onMarkDone({ weekIndex, zone, member, doneAt: today })
                      setSnackZone(zone)
                    }}
                  >
                    {t('week.markDone')}
                  </Button>
                ) : null}
                {isMine && completion ? (
                  <Dialog
                    open={layers.current === dateLayer(zone)}
                    onClose={() => {
                      layers.close(dateLayer(zone))
                      setUndoing(null)
                    }}
                    fullWidth
                    maxWidth="xs"
                  >
                    <DialogTitle>{zone}</DialogTitle>
                    <DialogContent>
                      <Stack spacing={2} sx={{ pt: 1 }}>
                        <TextField
                          type="date"
                          size="small"
                          slotProps={{ htmlInput: { 'aria-label': t('week.doneDate', { zone }) } }}
                          value={dates[zone] ?? completion.doneAt}
                          onChange={(event) => setDates({ ...dates, [zone]: event.target.value })}
                        />
                        {undoing === zone ? (
                          <Alert severity="warning">{t('week.undoText', { zone })}</Alert>
                        ) : null}
                      </Stack>
                    </DialogContent>
                    <DialogActions sx={{ justifyContent: 'space-between' }}>
                      <Button
                        onClick={() => {
                          // Giving up the confirmation returns to the dialog, so the date can still be
                          // changed or the undo tried again
                          if (undoing === zone) {
                            setUndoing(null)
                            return
                          }
                          layers.close(dateLayer(zone))
                        }}
                      >
                        {t('common.cancel')}
                      </Button>
                      {undoing === zone ? (
                        <Button
                          color="error"
                          variant="contained"
                          onClick={() => {
                            onUndoDone(weekIndex, zone)
                            setUndoing(null)
                            layers.close(dateLayer(zone))
                          }}
                        >
                          {t('week.undoConfirm')}
                        </Button>
                      ) : (
                        <Stack direction="row" spacing={1}>
                          <Button
                            color="error"
                            aria-label={t('week.undoAria', { zone })}
                            onClick={() => setUndoing(zone)}
                          >
                            {t('week.undo')}
                          </Button>
                          <Button
                            variant="contained"
                            onClick={() => {
                              onMarkDone({
                                weekIndex,
                                zone,
                                member,
                                doneAt: dates[zone] ?? completion.doneAt,
                              })
                              layers.close(dateLayer(zone))
                            }}
                          >
                            {t('week.updateDate')}
                          </Button>
                        </Stack>
                      )}
                    </DialogActions>
                  </Dialog>
                ) : null}
              </CardContent>
            </Card>
          </m.div>
        )
      })}
      <UpcomingWeeks weeks={upcoming} />
      {assignments.length > 0 ? (
        <Box sx={{ alignSelf: 'flex-start' }}>
          <ShareButton message={shareMessage} label={t('whatsapp.week.share')} />
        </Box>
      ) : null}
      <Snackbar
        open={snackZone !== null}
        autoHideDuration={4000}
        onClose={() => setSnackZone(null)}
        message={snackZone ? t('week.markedDone', { zone: snackZone }) : undefined}
        sx={{ bottom: { xs: 84 } }}
        action={
          snackZone ? (
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                void onUndoDone(weekIndex, snackZone)
                setSnackZone(null)
              }}
            >
              {t('week.undo')}
            </Button>
          ) : undefined
        }
      />
    </Stack>
  )
}
