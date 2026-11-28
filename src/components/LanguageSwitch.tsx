import { ToggleButton, ToggleButtonGroup } from '@mui/material'
import { LOCALES, setLocale } from '../i18n/i18n'
import { useTranslation } from '../i18n/useTranslation'

// The language follows the device by default; this lets a person change it, and it is remembered.
export const LanguageSwitch = () => {
  const { t, locale } = useTranslation()
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={locale}
      aria-label={t('common.language')}
      // Pressing the active language would deselect it: that is ignored
      onChange={(_, next) => (next === null ? undefined : setLocale(next))}
    >
      {LOCALES.map((code) => (
        <ToggleButton key={code} value={code} aria-label={code.toUpperCase()} sx={{ px: 1.5 }}>
          {code.toUpperCase()}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}
