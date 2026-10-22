import { Alert, Button, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { useColorScheme } from '@mui/material/styles'
import { useTranslation } from '../i18n/useTranslation'
import { LanguageSwitch } from './LanguageSwitch'

interface SettingsViewProps {
  isGoogle: boolean
  accountEmail: string | null
  linkBusy: boolean
  linkError: string | null
  version: string
  onLinkGoogle: () => void
  onLeave: () => void
}

type Mode = 'light' | 'dark' | 'system'
const MODES: Mode[] = ['light', 'dark', 'system']

// Everything about the app and the account, away from the day to day of the flat.
export const SettingsView = ({
  isGoogle,
  accountEmail,
  linkBusy,
  linkError,
  version,
  onLinkGoogle,
  onLeave,
}: SettingsViewProps) => {
  const { t } = useTranslation()
  // MUI remembers the choice itself; until it is known the device decides
  const { mode, setMode } = useColorScheme()

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h6" component="h2">
          {t('common.language')}
        </Typography>
        <LanguageSwitch />
      </Stack>

      <Stack spacing={1}>
        <Typography variant="h6" component="h2">
          {t('settings.appearance')}
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={mode ?? 'system'}
          aria-label={t('settings.appearance')}
          // Pressing the active option would deselect it: that is ignored
          onChange={(_, next: Mode | null) => (next === null ? undefined : setMode(next))}
        >
          {MODES.map((option) => (
            <ToggleButton key={option} value={option} sx={{ px: 2 }}>
              {t(`settings.theme.${option}`)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      <Stack spacing={1}>
        <Typography variant="h6" component="h2">
          {t('settings.account')}
        </Typography>
        {isGoogle ? (
          <Typography>
            {accountEmail ? t('settings.linkedAs', { email: accountEmail }) : t('settings.linked')}
          </Typography>
        ) : (
          <>
            <Typography color="text.secondary">{t('settings.notLinked')}</Typography>
            <Button variant="outlined" disabled={linkBusy} onClick={onLinkGoogle}>
              {linkBusy ? t('saveAccess.linking') : t('saveAccess.link')}
            </Button>
          </>
        )}
        {linkError ? <Alert severity="error">{linkError}</Alert> : null}
        <Button variant="outlined" onClick={onLeave}>
          {t('flat.leave')}
        </Button>
      </Stack>

      <Typography variant="body2" color="text.secondary">
        {t('settings.version', { version })}
      </Typography>
    </Stack>
  )
}
