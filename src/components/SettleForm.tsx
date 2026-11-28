import { useState } from 'react'
import { alpha } from '@mui/material/styles'
import { Alert, Avatar, Box, Button, IconButton, Stack, TextField, Typography } from '@mui/material'
import { AnimatePresence, m } from 'motion/react'
import { MAX_NOTE, validateSettlement, type Settlement } from '../domain/settlements'
import type { MessageKey } from '../i18n/i18n'
import { readableOn } from '../domain/color'
import { formatDay } from '../domain/dates'
import { weekEndDate } from '../domain/history'
import { UNKNOWN_PERSON_COLOR } from '../domain/palette'
import { useTranslation } from '../i18n/useTranslation'
import { ArrowRightIcon, SuitcaseIcon, SwapIcon } from './icons'
import { WeekCalendar, type PickableCleaning } from './WeekCalendar'
import { ZoneIcon } from './ZoneIcon'

// What the person chose. Who recorded it and which zone it is are added by the screen.
export type SettleInput = Pick<Settlement, 'kind' | 'tookWeek' | 'tookZone' | 'note'>

interface SettleFormProps {
  zone: string
  // First day of the week of the zone, YYYY-MM-DD: weeks are told by their date, never by a number
  startsOn: string
  // Local calendar date of today, YYYY-MM-DD
  today: string
  // Index of the week of the zone, to check that the cleaning taken is of a later one
  weekIndex: number
  // The cleanings of flatmates that are not done yet and can be taken to make it up
  takeable: PickableCleaning[]
  // Name and color of each person by id
  names: Record<string, string>
  colors?: Record<string, string>
  busy: boolean
  error: string | null
  onSave: (input: SettleInput) => void
  onCancel: () => void
  // The step the person is on, as how many steps in. The screen can keep it in the history, so the back
  // button of the phone goes back one step; without these the form keeps it itself.
  depth?: number
  onDepth?: (depth: number) => void
  onBack?: () => void
}

type Step = 'kind' | 'week' | 'task' | 'note'

// The steps of each way: making up asks which week and which cleaning; not being at the flat asks nothing
const STEPS: Record<'madeUp' | 'away', Step[]> = {
  madeUp: ['kind', 'week', 'task', 'note'],
  away: ['kind', 'note'],
}

const KINDS: Array<'madeUp' | 'away'> = ['madeUp', 'away']

const KIND_ICONS = { madeUp: SwapIcon, away: SuitcaseIcon }

const SPRING = { type: 'spring', stiffness: 260, damping: 24 } as const

// How long the week that was pressed stays highlighted before the next step (ms)
const PICK_DELAY = 350

// How the group settles a zone that nobody cleaned, one step at a time: how, which week, which cleaning,
// and a last look with a note that everybody can read.
export const SettleForm = ({
  zone,
  startsOn,
  today,
  weekIndex,
  takeable,
  names,
  colors = {},
  busy,
  error,
  onSave,
  onCancel,
  depth: controlledDepth,
  onDepth,
  onBack,
}: SettleFormProps) => {
  const { t, locale } = useTranslation()
  const [kind, setKind] = useState<'madeUp' | 'away' | null>(null)
  // The week that was pressed on the calendar, by its first day, and the cleaning chosen in it
  const [pickedWeek, setPickedWeek] = useState<string | null>(null)
  const [took, setTook] = useState('')
  const [note, setNote] = useState('')
  const [problems, setProblems] = useState<string[]>([])
  const [ownDepth, setOwnDepth] = useState(0)
  const [direction, setDirection] = useState(1)
  // The week that was just pressed stays highlighted for a moment before the next step
  const [picking, setPicking] = useState(false)

  const depth = controlledDepth ?? ownDepth
  const goTo = (next: number) => {
    setDirection(1)
    setProblems([])
    if (onDepth) onDepth(next)
    else setOwnDepth(next)
  }
  const goBack = () => {
    setDirection(-1)
    setProblems([])
    if (onBack) onBack()
    else setOwnDepth(Math.max(0, depth - 1))
  }

  const chosen = takeable.find((item) => `${item.weekIndex}_${item.zone}` === took)
  // The step shown: if the page was reloaded in the middle of the steps what was chosen is gone, so it
  // starts again from the first step that lacks it
  const steps = kind ? STEPS[kind] : null
  const wanted: Step = steps?.[depth] ?? 'kind'
  const step: Step =
    kind === null
      ? 'kind'
      : wanted === 'task' && pickedWeek === null
        ? 'week'
        : wanted === 'note' && kind === 'madeUp' && !chosen
          ? pickedWeek === null
            ? 'week'
            : 'task'
          : wanted

  const day = (iso: string) => formatDay(iso, locale)
  const ownFrom = day(startsOn)
  const ownTo = day(weekEndDate(startsOn, 0))
  const total = kind ? STEPS[kind].length : STEPS.madeUp.length
  const number = (steps ?? STEPS.madeUp).indexOf(step) + 1

  const save = () => {
    if (kind === null) return
    const input: SettleInput = {
      kind,
      ...(kind === 'madeUp' && chosen ? { tookWeek: chosen.weekIndex, tookZone: chosen.zone } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    }
    const found = validateSettlement({ weekIndex, zone, memberId: '', ...input }, '')
    setProblems(found)
    if (found.length === 0) onSave(input)
  }

  const header = (title: string) => (
    <Stack spacing={0.5} sx={{ pb: 1 }}>
      {step === 'kind' ? null : (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', ml: -1 }}>
          <IconButton aria-label={t('common.back')} onClick={goBack} size="small">
            <ArrowRightIcon aria-hidden="true" sx={{ transform: 'rotate(180deg)' }} />
          </IconButton>
          <Typography variant="caption" color="text.secondary">
            {t('settle.step', { n: number, total })}
          </Typography>
        </Stack>
      )}
      <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
    </Stack>
  )

  const weekTasks =
    pickedWeek === null ? [] : takeable.filter((item) => item.startsOn === pickedWeek)

  return (
    <Stack
      role="group"
      aria-label={t('settle.group', { zone, date: ownFrom, endDate: ownTo })}
      sx={{ pt: 1, overflow: 'hidden' }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={step}
          initial={{ opacity: 0, x: direction * 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -24 }}
          transition={SPRING}
        >
          {step === 'kind' ? (
            <Stack spacing={2}>
              {header(t('settle.step.kind'))}
              <Stack spacing={1}>
                {KINDS.map((option) => {
                  const Icon = KIND_ICONS[option]
                  return (
                    <Box
                      key={option}
                      component="button"
                      type="button"
                      onClick={() => {
                        setKind(option)
                        setPickedWeek(null)
                        setTook('')
                        goTo(1)
                      }}
                      sx={cardSx}
                    >
                      <Icon sx={{ flexShrink: 0, color: 'action.active' }} />
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {t(`settle.kind.${option}`)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t(`settle.kind.${option}.desc` as MessageKey)}
                        </Typography>
                      </Box>
                    </Box>
                  )
                })}
              </Stack>
              <Button onClick={onCancel}>{t('common.cancel')}</Button>
            </Stack>
          ) : step === 'week' ? (
            <Stack spacing={1}>
              {header(t('settle.step.week'))}
              {takeable.length === 0 ? (
                <Alert severity="info">{t('settle.noneToTake')}</Alert>
              ) : (
                <WeekCalendar
                  cleanings={takeable}
                  today={today}
                  selected={pickedWeek}
                  onPick={(week) => {
                    if (picking) return
                    setPickedWeek(week)
                    setTook('')
                    setPicking(true)
                    // Long enough to see which week was pressed, short enough not to feel slow
                    window.setTimeout(() => {
                      setPicking(false)
                      goTo(2)
                    }, PICK_DELAY)
                  }}
                />
              )}
            </Stack>
          ) : step === 'task' && pickedWeek !== null ? (
            <Stack spacing={1}>
              {header(
                t('settle.pick.zones', {
                  date: day(pickedWeek),
                  endDate: day(weekEndDate(pickedWeek, 0)),
                }),
              )}
              <Stack spacing={1} role="group" aria-label={t('settle.take')}>
                {weekTasks.map((item) => {
                  const name = names[item.fromId] ?? '?'
                  const color = colors[item.fromId] ?? UNKNOWN_PERSON_COLOR
                  return (
                    <Box
                      key={`${item.weekIndex}_${item.zone}`}
                      component="button"
                      type="button"
                      aria-label={t('settle.pick.option', { zone: item.zone, name })}
                      onClick={() => {
                        setTook(`${item.weekIndex}_${item.zone}`)
                        goTo(3)
                      }}
                      sx={cardSx}
                    >
                      <ZoneIcon zone={item.zone} color="action" aria-hidden="true" />
                      <Typography sx={{ fontWeight: 700, flexGrow: 1 }}>{item.zone}</Typography>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Avatar
                          aria-hidden="true"
                          sx={{
                            width: 28,
                            height: 28,
                            fontSize: 14,
                            bgcolor: color,
                            color: readableOn(color),
                          }}
                        >
                          {name.charAt(0).toUpperCase()}
                        </Avatar>
                        <Typography variant="body2" aria-hidden="true">
                          {name}
                        </Typography>
                      </Stack>
                    </Box>
                  )
                })}
              </Stack>
            </Stack>
          ) : (
            <Stack spacing={2}>
              {header(t('settle.step.note'))}
              <Alert severity="info" icon={false}>
                {kind === 'madeUp' && chosen
                  ? t('settle.summary.madeUp', {
                      zone: chosen.zone,
                      name: names[chosen.fromId] ?? '?',
                      from: day(chosen.startsOn),
                      to: day(weekEndDate(chosen.startsOn, 0)),
                      ownZone: zone,
                      ownFrom,
                      ownTo,
                    })
                  : t('settle.summary.away', { ownZone: zone, ownFrom, ownTo })}
              </Alert>
              <TextField
                fullWidth
                multiline
                minRows={2}
                size="small"
                label={t('settle.note')}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                helperText={t('settle.noteCount', { n: note.length, max: MAX_NOTE })}
                slotProps={{ htmlInput: { maxLength: MAX_NOTE } }}
              />
              {problems.length > 0 ? (
                <Alert severity="error">
                  {problems.map((code) => (
                    <div key={code}>{t(`settle.error.${code}` as MessageKey)}</div>
                  ))}
                </Alert>
              ) : null}
              {error ? <Alert severity="error">{error}</Alert> : null}
              <Stack direction="row" spacing={1}>
                <Button onClick={onCancel}>{t('common.cancel')}</Button>
                <Button variant="contained" disabled={busy} onClick={save}>
                  {busy ? t('common.saving') : t('settle.save')}
                </Button>
              </Stack>
            </Stack>
          )}
        </m.div>
      </AnimatePresence>
    </Stack>
  )
}

// A big button that looks like a card: a way to settle, or a cleaning to take
const cardSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  p: 1.5,
  border: 2,
  borderRadius: 2,
  borderColor: 'divider',
  bgcolor: 'transparent',
  color: 'text.primary',
  cursor: 'pointer',
  textAlign: 'left',
  font: 'inherit',
  width: '100%',
  transition: 'border-color 0.15s, background-color 0.15s',
  '&:hover': {
    borderColor: 'text.secondary',
    bgcolor: (theme: { palette: { action: { hover: string } } }) =>
      alpha(theme.palette.action.hover, 0.5),
  },
} as const
