import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material'
import { HomeIcon, PeopleIcon, SparkleIcon } from './icons'

export type Tab = 'week' | 'people' | 'flat'

const TABS: Array<{ value: Tab; label: string; icon: React.ReactElement }> = [
  { value: 'week', label: 'Week', icon: <SparkleIcon /> },
  { value: 'people', label: 'People', icon: <PeopleIcon /> },
  { value: 'flat', label: 'Flat', icon: <HomeIcon /> },
]

interface BottomTabsProps {
  value: Tab
  onChange: (value: Tab) => void
}

// Navigation within reach of the thumb. The current section is exposed with aria-current.
export const BottomTabs = ({ value, onChange }: BottomTabsProps) => (
  <Paper
    elevation={8}
    component="nav"
    aria-label="Sections"
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
          label={tab.label}
          icon={tab.icon}
          aria-current={tab.value === value ? 'page' : undefined}
          onClick={() => onChange(tab.value)}
        />
      ))}
    </BottomNavigation>
  </Paper>
)
