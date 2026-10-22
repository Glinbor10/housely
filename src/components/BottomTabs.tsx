import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material'
import { useTranslation } from '../i18n/useTranslation'
import { HistoryIcon, HomeIcon, SettingsIcon, SparkleIcon } from './icons'

export type Tab = 'week' | 'history' | 'flat' | 'settings'

const TABS: Array<{ value: Tab; icon: React.ReactElement }> = [
  { value: 'week', icon: <SparkleIcon /> },
  { value: 'history', icon: <HistoryIcon /> },
  { value: 'flat', icon: <HomeIcon /> },
  { value: 'settings', icon: <SettingsIcon /> },
]

interface BottomTabsProps {
  value: Tab
  onChange: (value: Tab) => void
}

// Navigation within reach of the thumb. The current section is exposed with aria-current.
export const BottomTabs = ({ value, onChange }: BottomTabsProps) => {
  const { t } = useTranslation()
  return (
    <Paper
      elevation={8}
      component="nav"
      aria-label={t('tab.sections')}
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10,
        borderRadius: '24px 24px 0 0',
        pb: 'env(safe-area-inset-bottom)',
      }}
    >
      <BottomNavigation showLabels value={value} sx={{ bgcolor: 'transparent', height: 68 }}>
        {TABS.map((tab) => (
          <BottomNavigationAction
            key={tab.value}
            value={tab.value}
            label={t(`tab.${tab.value}`)}
            icon={tab.icon}
            aria-current={tab.value === value ? 'page' : undefined}
            onClick={() => onChange(tab.value)}
          />
        ))}
      </BottomNavigation>
    </Paper>
  )
}
