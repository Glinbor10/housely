import { useState } from 'react'
import { Alert, Button, Stack } from '@mui/material'
import { formatDay } from '../domain/dates'
import { weekEndDate } from '../domain/history'
import { useTranslation } from '../i18n/useTranslation'

export interface TakeoverNotice {
  zone: string
  // First day of the week, YYYY-MM-DD: weeks are told by their date
  startsOn: string
  takerName: string
  // Whether it is the week that is running now
  current: boolean
}

interface TakeoverNoticesProps {
  notices: TakeoverNotice[]
}

// Tells a person that a flatmate does a zone of theirs, so they know they do not have to clean it.
// It is derived from the data: it stays while the cleaning is there and goes with it.
const MAX_NOTICES_SHOWN = 3

export const TakeoverNotices = ({ notices }: TakeoverNoticesProps) => {
  const { t, locale } = useTranslation()
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? notices : notices.slice(0, MAX_NOTICES_SHOWN)
  return notices.length === 0 ? null : (
    <Stack spacing={1}>
      {visible.map((notice) => (
        <Alert key={`${notice.startsOn}_${notice.zone}`} severity="info">
          {t(notice.current ? 'takeover.noticeNow' : 'takeover.noticeLater', {
            name: notice.takerName,
            zone: notice.zone,
            date: formatDay(notice.startsOn, locale),
            endDate: formatDay(weekEndDate(notice.startsOn, 0), locale),
          })}
        </Alert>
      ))}
      {notices.length > MAX_NOTICES_SHOWN ? (
        <Button sx={{ alignSelf: 'center' }} onClick={() => setShowAll(!showAll)}>
          {showAll
            ? t('history.showLess')
            : t('history.showMore', { n: notices.length - MAX_NOTICES_SHOWN })}
        </Button>
      ) : null}
    </Stack>
  )
}
