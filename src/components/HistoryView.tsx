import { UNKNOWN_PERSON_COLOR } from '../domain/palette'
import { SIZE } from '../theme'
import { useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { AnimatePresence, m } from 'motion/react'
import { Appear } from './Appear'
import type { CalendarCompletion } from '../domain/calendar'
import { weekEndDate, type HistoryWeek, type PersonStats, type ZoneStats } from '../domain/history'
import { useTranslation } from '../i18n/useTranslation'
import { MonthCalendar } from './MonthCalendar'
import { formatDay } from '../domain/dates'
import type { PickableCleaning } from './WeekCalendar'
import { EmptyState } from './EmptyState'
import { ShareButton } from './ShareButton'
import { ZoneIcon } from './ZoneIcon'
import { SettleForm, type SettleInput } from './SettleForm'
import { layerBase, layerDepth, useLayer, withDepth, type LayerProps } from './useLayer'

type View = 'calendar' | 'list'

// What the history needs to let people settle the zones that nobody cleaned. Without it the history
// is only to be read.
export interface SettleSupport {
  // The cleanings of flatmates that are not done yet and can be taken to make up a zone
  takeable: PickableCleaning[]
  currentMemberId: string
  isOwner: boolean
  busy: boolean
  error: string | null
  // Resolves to whether it was saved
  onSettle: (input: SettleInput & { weekIndex: number; zone: string }) => Promise<boolean>
  onUndo: (weekIndex: number, zone: string) => void
}

interface HistoryViewProps extends LayerProps {
  weeks: HistoryWeek[]
  // Name and color of each person by id
  names: Record<string, string>
  colors: Record<string, string>
  currentWeek: number
  // First day of a week of the rotation, YYYY-MM-DD: weeks are told by their date
  weekStart: (weekIndex: number) => string
  people: PersonStats[]
  zones: ZoneStats[]
  calendarCompletions: CalendarCompletion[]
  // Local calendar date of today, YYYY-MM-DD
  today: string
  initialView?: View
  settle?: SettleSupport
}

type ListProps = Pick<
  HistoryViewProps,
  'weeks' | 'names' | 'colors' | 'currentWeek' | 'weekStart' | 'people' | 'zones'
>

type Translate = ReturnType<typeof useTranslation>['t']

// How a zone was settled, in a few words
const settlementLabel = (
  t: Translate,
  names: Record<string, string>,
  settlement: NonNullable<HistoryWeek['entries'][number]['settlement']>,
  day: (iso: string) => string,
  weekStart: (weekIndex: number) => string,
): string =>
  settlement.kind === 'late'
    ? t('settle.chip.late', { date: settlement.doneAt ? day(settlement.doneAt) : '' })
    : settlement.kind === 'covered'
      ? t('settle.chip.covered', { name: names[settlement.coveredBy ?? ''] ?? '?' })
      : settlement.kind === 'madeUp'
        ? t('settle.chip.madeUp', {
            zone: settlement.tookZone ?? '?',
            date: day(weekStart(settlement.tookWeek ?? 0)),
          })
        : t('settle.chip.away')

const WEEKS_SHOWN = 8

// Only a summary: what was done, what is pending and what was missed or settled, week by week
const HistoryList = ({
  weeks,
  names,
  colors,
  currentWeek,
  weekStart,
  people,
  zones,
}: ListProps) => {
  const { t, locale } = useTranslation()
  const day = (iso: string) => formatDay(iso, locale)
  const [shown, setShown] = useState(WEEKS_SHOWN)

  return weeks.length === 0 ? (
    <EmptyState text={t('history.empty')} />
  ) : (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h6" component="h2">
          {t('history.byPerson')}
        </Typography>
        <Stack component="ul" spacing={1} sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {people.map((person) => (
            <Card
              key={person.memberId}
              component="li"
              variant="outlined"
              aria-label={names[person.memberId] ?? '?'}
            >
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Box
                    aria-hidden="true"
                    data-testid="color-dot"
                    sx={{
                      width: SIZE.dot,
                      height: SIZE.dot,
                      borderRadius: '50%',
                      flexShrink: 0,
                      bgcolor: colors[person.memberId] ?? 'action.disabled',
                    }}
                  />
                  <Typography sx={{ flexGrow: 1, fontWeight: 700 }}>
                    {names[person.memberId] ?? '?'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('history.progress', { done: person.done, assigned: person.assigned })}
                  </Typography>
                  {person.missed > 0 ? (
                    <Chip
                      size="small"
                      color="warning"
                      label={t('history.missedCount', { n: person.missed })}
                    />
                  ) : null}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Stack>

      <Stack spacing={1}>
        <Typography variant="h6" component="h2">
          {t('history.byZone')}
        </Typography>
        <Stack spacing={1.5}>
          {zones.map((zone) => (
            <Stack key={zone.zone} spacing={0.5}>
              <Stack
                direction="row"
                sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {zone.zone}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('history.progress', { done: zone.done, assigned: zone.assigned })}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={zone.assigned > 0 ? Math.round((zone.done / zone.assigned) * 100) : 0}
                aria-label={t('history.progress', { done: zone.done, assigned: zone.assigned })}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Stack>
          ))}
        </Stack>
      </Stack>

      <Stack spacing={1}>
        <Typography variant="h6" component="h2">
          {t('history.weeks')}
        </Typography>
        {weeks.slice(0, shown).map((week, index) => {
          const card = (
            <Card
              variant="outlined"
              sx={
                week.weekIndex === currentWeek
                  ? { borderColor: 'primary.main', borderWidth: 2 }
                  : undefined
              }
            >
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Typography
                      variant="subtitle1"
                      component="h3"
                      sx={{ fontWeight: 800, flexGrow: 1 }}
                    >
                      {t('history.weekOf', {
                        date: day(week.startsOn),
                        endDate: day(weekEndDate(week.startsOn, 0)),
                      })}
                    </Typography>
                    {week.weekIndex === currentWeek ? (
                      <Chip size="small" color="primary" label={t('history.currentWeek')} />
                    ) : null}
                  </Stack>
                  {week.entries.map((entry) => {
                    const { settlement } = entry
                    const missed =
                      entry.doneAt === null && !settlement && week.weekIndex < currentWeek
                    return (
                      <Stack key={entry.zone} spacing={1}>
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                        >
                          <ZoneIcon zone={entry.zone} color="action" />
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography>{entry.zone}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {names[entry.memberId] ?? '?'}
                            </Typography>
                            {entry.takeover ? (
                              <Typography variant="body2" color="text.secondary">
                                {t('settle.takenFrom', {
                                  name: names[entry.takeover.fromId] ?? '?',
                                  date: day(weekStart(entry.takeover.debtWeek)),
                                  endDate: day(weekEndDate(weekStart(entry.takeover.debtWeek), 0)),
                                })}
                              </Typography>
                            ) : null}
                          </Box>
                          {entry.doneAt !== null ? (
                            <Chip
                              size="small"
                              color="success"
                              label={t('week.done', { date: day(entry.doneAt) })}
                            />
                          ) : settlement ? (
                            <Chip
                              size="small"
                              color={settlement.kind === 'away' ? 'default' : 'success'}
                              variant="outlined"
                              label={settlementLabel(t, names, settlement, day, weekStart)}
                            />
                          ) : missed ? (
                            <Chip size="small" color="warning" label={t('history.missed')} />
                          ) : (
                            <Chip size="small" label={t('week.pending')} />
                          )}
                        </Stack>
                      </Stack>
                    )
                  })}
                  {week.resting.length > 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      {t('history.resting', {
                        names: week.resting.map((id) => names[id] ?? '?').join(', '),
                      })}
                    </Typography>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>
          )
          // The weeks that "show older" adds slide in
          return (
            <Appear key={week.weekIndex} enabled={index >= WEEKS_SHOWN}>
              {card}
            </Appear>
          )
        })}
        {shown < weeks.length ? (
          <Button onClick={() => setShown(shown + WEEKS_SHOWN)}>{t('history.showOlder')}</Button>
        ) : null}
      </Stack>
    </Stack>
  )
}

type SectionProps = Pick<
  HistoryViewProps,
  'weeks' | 'names' | 'colors' | 'currentWeek' | 'weekStart' | 'today' | keyof LayerProps
> & {
  settle: SettleSupport
  // The zones nobody cleaned go above the calendar (a person acts on them); the settled ones go below it
  show: 'missed' | 'settled'
}

// Under the calendar: the zones that nobody cleaned, to settle them, and the ones already settled. The
// cleaning that makes a zone up is chosen on a calendar too.
const SettleSection = ({
  weeks,
  names,
  currentWeek,
  weekStart,
  today,
  colors,
  settle,
  show,
  layer,
  onOpenLayer,
  onCloseLayer,
  onBackLayer,
}: SectionProps) => {
  const { t, locale } = useTranslation()
  const day = (iso: string) => formatDay(iso, locale)
  // The form of a zone is a layer, one at a time: the back button closes it
  const layers = useLayer({ layer, onOpenLayer, onCloseLayer, onBackLayer })
  const settleLayer = (weekIndex: number, zone: string) => `settle:${weekIndex}_${zone}`
  // Tracks the settle layer that just cleared the current member's last pending zone
  const [debtFreeLayer, setDebtFreeLayer] = useState<string | null>(null)

  const rows = weeks.flatMap((week) => week.entries.map((entry) => ({ week, entry })))
  const missed = rows.filter(
    ({ week, entry }) => entry.doneAt === null && !entry.settlement && week.weekIndex < currentWeek,
  )
  const settled = rows.filter(({ entry }) => entry.settlement !== undefined)
  const MAX_SETTLE_SHOWN = 4
  const [showAllMissed, setShowAllMissed] = useState(false)
  const [showAllSettled, setShowAllSettled] = useState(false)
  const visibleMissed = showAllMissed ? missed : missed.slice(0, MAX_SETTLE_SHOWN)
  const visibleSettled = showAllSettled ? settled : settled.slice(0, MAX_SETTLE_SHOWN)

  // Hall-of-shame WhatsApp message: one line per uncleaned zone
  const shameMessage = [
    t('whatsapp.shame.header'),
    ...missed.map(({ week, entry }) =>
      t('whatsapp.shame.row', {
        zone: entry.zone,
        name: names[entry.memberId] ?? '?',
        weekLabel: t('whatsapp.shame.weekLabel', {
          date: day(week.startsOn),
          endDate: day(weekEndDate(week.startsOn, 0)),
        }),
      }),
    ),
  ].join('\n')

  // How many of the current member's zones are still missed (used to detect debt-free after settle)
  const myMissedCount = missed.filter(
    ({ entry }) => entry.memberId === settle.currentMemberId,
  ).length

  return (show === 'missed' ? missed.length === 0 : settled.length === 0) ? null : (
    <Stack spacing={2}>
      {show === 'missed' && missed.length > 0 ? (
        <Stack component="section" aria-label={t('settle.section')} spacing={1}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" component="h3">
              {t('settle.section')}
            </Typography>
            <ShareButton message={shameMessage} label={t('whatsapp.shame.share')} size="small" />
          </Stack>
          {visibleMissed.map(({ week, entry }, index) => {
            const layerKey = settleLayer(week.weekIndex, entry.zone)
            const memberName = names[settle.currentMemberId] ?? '?'
            const freeMessage = t('whatsapp.free.message', { name: memberName })
            return (
              <Appear key={`${week.weekIndex}_${entry.zone}`} enabled={index >= MAX_SETTLE_SHOWN}>
                <Stack
                  spacing={1}
                  // The zones of the person stand out with a red edge and "Yours"; the others stay quiet
                  sx={{
                    borderLeft: 4,
                    borderColor:
                      entry.memberId === settle.currentMemberId ? 'error.main' : 'transparent',
                    pl: 1.5,
                    py: 0.5,
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <ZoneIcon zone={entry.zone} color="action" />
                    <Box sx={{ flexGrow: 1 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Typography sx={{ fontWeight: 700 }}>{entry.zone}</Typography>
                        {entry.memberId === settle.currentMemberId ? (
                          <Chip
                            size="small"
                            color="primary"
                            variant="outlined"
                            label={t('settle.yours')}
                          />
                        ) : null}
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {`${names[entry.memberId] ?? '?'} · ${t('settle.weekOf', { date: day(week.startsOn), endDate: day(weekEndDate(week.startsOn, 0)) })}`}
                      </Typography>
                    </Box>
                    {entry.memberId === settle.currentMemberId ? (
                      <Button
                        size="small"
                        variant="outlined"
                        aria-label={t('settle.buttonAria', {
                          zone: entry.zone,
                          date: day(week.startsOn),
                        })}
                        onClick={() => layers.open(layerKey)}
                      >
                        {t('settle.button')}
                      </Button>
                    ) : (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ textAlign: 'right' }}
                      >
                        {t('settle.waiting', { name: names[entry.memberId] ?? '?' })}
                      </Typography>
                    )}
                  </Stack>
                  {/* Settling a zone is a modal of its own: it says which zone and week it is about */}
                  <Dialog
                    open={layerBase(layers.current) === layerKey}
                    fullWidth
                    maxWidth="sm"
                    onClose={() => {
                      setDebtFreeLayer(null)
                      layers.close(layerKey)
                    }}
                  >
                    <DialogTitle>
                      {t('settle.dialogTitle', { zone: entry.zone })}
                      <Typography variant="body2" color="text.secondary" component="div">
                        {`${names[entry.memberId] ?? '?'} · ${t('settle.weekOf', { date: day(week.startsOn), endDate: day(weekEndDate(week.startsOn, 0)) })}`}
                      </Typography>
                    </DialogTitle>
                    <DialogContent>
                      <AnimatePresence mode="wait">
                        {debtFreeLayer === layerKey ? (
                          <m.div
                            key="free"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                          >
                            <Stack spacing={1}>
                              <Typography color="success.main" sx={{ fontWeight: 600 }}>
                                {t('whatsapp.free.congrats')}
                              </Typography>
                              <Stack direction="row" spacing={1}>
                                <ShareButton
                                  message={freeMessage}
                                  label={t('whatsapp.free.share')}
                                  variant="contained"
                                />
                                <Button
                                  onClick={() => {
                                    setDebtFreeLayer(null)
                                    layers.close(layerKey)
                                  }}
                                >
                                  {t('common.close')}
                                </Button>
                              </Stack>
                            </Stack>
                          </m.div>
                        ) : (
                          <m.div
                            key="form"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                          >
                            <SettleForm
                              zone={entry.zone}
                              startsOn={week.startsOn}
                              today={today}
                              weekIndex={week.weekIndex}
                              takeable={settle.takeable}
                              names={names}
                              colors={colors}
                              busy={settle.busy}
                              error={settle.error}
                              depth={
                                layerBase(layers.current) === layerKey
                                  ? layerDepth(layers.current)
                                  : 0
                              }
                              onDepth={(depth) => layers.open(withDepth(layerKey, depth))}
                              onBack={() => layers.back(layerKey)}
                              onCancel={() => layers.close(layerKey)}
                              onSave={async (input) => {
                                const saved = await settle.onSettle({
                                  ...input,
                                  weekIndex: week.weekIndex,
                                  zone: entry.zone,
                                })
                                if (saved) {
                                  // If this was the member's last pending zone, show the debt-free share prompt
                                  if (
                                    myMissedCount === 1 &&
                                    entry.memberId === settle.currentMemberId
                                  ) {
                                    setDebtFreeLayer(layerKey)
                                  } else {
                                    // Another zone may have been opened while this one was saving: that one stays
                                    layers.close(layerKey)
                                  }
                                }
                              }}
                            />
                          </m.div>
                        )}
                      </AnimatePresence>
                    </DialogContent>
                  </Dialog>
                </Stack>
              </Appear>
            )
          })}
          {missed.length > MAX_SETTLE_SHOWN ? (
            <Button sx={{ alignSelf: 'center' }} onClick={() => setShowAllMissed(!showAllMissed)}>
              {showAllMissed
                ? t('history.showLess')
                : t('history.showMore', { n: missed.length - MAX_SETTLE_SHOWN })}
            </Button>
          ) : null}
        </Stack>
      ) : null}

      {show === 'settled' && settled.length > 0 ? (
        <Stack component="section" aria-label={t('settle.sectionSettled')} spacing={1}>
          <Typography variant="h6" component="h3">
            {t('settle.sectionSettled')}
          </Typography>
          {visibleSettled.map(({ week, entry }, index) => {
            const settlement = entry.settlement!
            // A zone made up with a cleaning can be undone while that cleaning is not done
            const tookEntry =
              settlement.kind === 'madeUp'
                ? weeks
                    .find((item) => item.weekIndex === settlement.tookWeek)
                    ?.entries.find((item) => item.zone === settlement.tookZone)
                : undefined
            const canUndo =
              (settle.isOwner || settle.currentMemberId === settlement.memberId) &&
              tookEntry?.doneAt == null
            return (
              <Appear key={`${week.weekIndex}_${entry.zone}`} enabled={index >= MAX_SETTLE_SHOWN}>
                <Stack spacing={0.25}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <ZoneIcon zone={entry.zone} color="action" />
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography sx={{ fontWeight: 700 }}>{entry.zone}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {`${names[entry.memberId] ?? '?'} · ${t('settle.weekOf', { date: day(week.startsOn), endDate: day(weekEndDate(week.startsOn, 0)) })}`}
                      </Typography>
                      {/* How it was settled is a line of its own: inside a pill it wrapped on narrow phones */}
                      <Typography
                        variant="body2"
                        sx={(theme) => ({
                          fontWeight: 600,
                          color:
                            settlement.kind === 'away'
                              ? theme.palette.text.secondary
                              : theme.palette.mode === 'dark'
                                ? theme.palette.success.light
                                : theme.palette.success.dark,
                        })}
                      >
                        {settlementLabel(t, names, settlement, day, weekStart)}
                      </Typography>
                    </Box>
                  </Stack>
                  {settlement.note ? <Typography>{settlement.note}</Typography> : null}
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    {
                      // Who owed the zone settled it: it is only said when somebody else recorded it
                      settlement.memberId !== entry.memberId ? (
                        <Typography variant="body2" color="text.secondary">
                          {t('settle.by', { name: names[settlement.memberId] ?? '?' })}
                        </Typography>
                      ) : null
                    }
                    {canUndo ? (
                      <Button
                        size="small"
                        aria-label={t('settle.undoAria', {
                          zone: entry.zone,
                          date: day(week.startsOn),
                        })}
                        onClick={() => settle.onUndo(week.weekIndex, entry.zone)}
                      >
                        {t('settle.undo')}
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              </Appear>
            )
          })}
          {settled.length > MAX_SETTLE_SHOWN ? (
            <Button sx={{ alignSelf: 'center' }} onClick={() => setShowAllSettled(!showAllSettled)}>
              {showAllSettled
                ? t('history.showLess')
                : t('history.showMore', { n: settled.length - MAX_SETTLE_SHOWN })}
            </Button>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  )
}

// The cleanings seen on a calendar, at a glance, or week by week with the numbers per person.
export const HistoryView = ({
  weeks,
  names,
  colors,
  currentWeek,
  weekStart,
  people,
  zones,
  calendarCompletions,
  today,
  initialView = 'calendar',
  settle,
  layer,
  onOpenLayer,
  onCloseLayer,
  onBackLayer,
}: HistoryViewProps) => {
  const { t } = useTranslation()
  const [view, setView] = useState<View>(initialView)

  return weeks.length === 0 ? (
    <EmptyState text={t('history.empty')} />
  ) : (
    <Stack spacing={3}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={view}
        aria-label={t('history.view')}
        sx={{ alignSelf: 'flex-start' }}
        // Pressing the active view would deselect it: that is ignored
        onChange={(_, next: View | null) => (next === null ? undefined : setView(next))}
      >
        <ToggleButton value="calendar" sx={{ px: 2 }}>
          {t('history.viewCalendar')}
        </ToggleButton>
        <ToggleButton value="list" sx={{ px: 2 }}>
          {t('history.viewList')}
        </ToggleButton>
      </ToggleButtonGroup>
      <m.div
        key={view}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
      >
        {view === 'calendar' ? (
          <Stack spacing={3}>
            {settle ? (
              <SettleSection
                show="missed"
                weeks={weeks}
                names={names}
                currentWeek={currentWeek}
                weekStart={weekStart}
                today={today}
                colors={colors}
                settle={settle}
                layer={layer}
                onOpenLayer={onOpenLayer}
                onCloseLayer={onCloseLayer}
                onBackLayer={onBackLayer}
              />
            ) : null}
            <MonthCalendar
              completions={calendarCompletions}
              people={Object.fromEntries(
                Object.entries(names).map(([id, name]) => [
                  id,
                  { name, color: colors[id] ?? UNKNOWN_PERSON_COLOR },
                ]),
              )}
              today={today}
              rotationStart={weekStart(0)}
              currentWeekOnly
            />
            {settle ? (
              <SettleSection
                show="settled"
                weeks={weeks}
                names={names}
                currentWeek={currentWeek}
                weekStart={weekStart}
                today={today}
                colors={colors}
                settle={settle}
                layer={layer}
                onOpenLayer={onOpenLayer}
                onCloseLayer={onCloseLayer}
                onBackLayer={onBackLayer}
              />
            ) : null}
          </Stack>
        ) : (
          <HistoryList
            weeks={weeks}
            names={names}
            colors={colors}
            currentWeek={currentWeek}
            weekStart={weekStart}
            people={people}
            zones={zones}
          />
        )}
      </m.div>
    </Stack>
  )
}
