import { Badge, BottomNavigation, BottomNavigationAction, Paper } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useTranslation } from '../i18n/useTranslation'
import { TAB_BAR_HEIGHT, TAB_BAR_OFFSET } from '../theme'
import { HistoryIcon, PeopleIcon, ReceiptArrowsIcon, SettingsIcon, SparkleIcon } from './icons'

export type Tab = 'week' | 'history' | 'members' | 'expenses' | 'settings'

const TABS: Array<{ value: Tab; icon: React.ReactElement }> = [
  { value: 'week', icon: <SparkleIcon /> },
  { value: 'history', icon: <HistoryIcon /> },
  { value: 'members', icon: <PeopleIcon /> },
  { value: 'expenses', icon: <ReceiptArrowsIcon /> },
  { value: 'settings', icon: <SettingsIcon /> },
]

interface BottomTabsProps {
  value: Tab
  onChange: (value: Tab) => void
  // How many zones of past weeks the current person has not settled: it shows as a number on History
  historyCount?: number
}

// Navigation within reach of the thumb. The current section is exposed with aria-current.
export const BottomTabs = ({ value, onChange, historyCount = 0 }: BottomTabsProps) => {
  const { t } = useTranslation()
  return (
    <Paper
      elevation={0}
      component="nav"
      aria-label={t('tab.sections')}
      sx={(theme) => ({
        position: 'fixed',
        // As wide as the column of the page (552 px), centered, so on a wide screen the bar does not spread
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 24px)',
        maxWidth: 552,
        bottom: `max(${TAB_BAR_OFFSET}px, env(safe-area-inset-bottom, 0px))`,
        zIndex: 10,
        borderRadius: '999px',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        backgroundColor: alpha(theme.palette.background.paper, 0.88),
        boxShadow: '0 4px 28px rgba(44,93,184,0.14), 0 1px 8px rgba(0,0,0,0.08)',
        border: '1px solid',
        borderColor: alpha(theme.palette.divider, 0.5),
      })}
    >
      <BottomNavigation
        value={value}
        // The name of each section is always there: with icons alone, people have to guess what is behind
        showLabels
        sx={{ bgcolor: 'transparent', height: TAB_BAR_HEIGHT, borderRadius: '999px' }}
      >
        {TABS.map((tab) => (
          <BottomNavigationAction
            key={tab.value}
            value={tab.value}
            label={t(`tab.${tab.value}`)}
            // The number is said too: the section and how many cleanings wait in it
            aria-label={
              tab.value === 'history' && historyCount > 0
                ? t('tab.historyPending', { n: historyCount })
                : undefined
            }
            icon={
              tab.value === 'history' ? (
                <Badge
                  badgeContent={historyCount}
                  max={9}
                  color="error"
                  invisible={historyCount === 0}
                >
                  <HistoryIcon />
                </Badge>
              ) : (
                tab.icon
              )
            }
            aria-current={tab.value === value ? 'page' : undefined}
            // The five sections share the bar: the default minimum of 80 px does not fit in 360 px
            sx={{ minWidth: 0, maxWidth: 'none', px: 0.5 }}
            onClick={() => onChange(tab.value)}
          />
        ))}
      </BottomNavigation>
    </Paper>
  )
}
