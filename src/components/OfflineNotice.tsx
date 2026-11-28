import { Alert } from '@mui/material'
import { m } from 'motion/react'
import { useTranslation } from '../i18n/useTranslation'

interface OfflineNoticeProps {
  offline: boolean
}

// Said once and quietly: what the person does is kept and sent when the connection is back, so it never
// looks like something failed.
export const OfflineNotice = ({ offline }: OfflineNoticeProps) => {
  const { t } = useTranslation()
  return offline ? (
    <m.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
    >
      <Alert severity="info" role="status">
        {t('offline.notice')}
      </Alert>
    </m.div>
  ) : null
}
