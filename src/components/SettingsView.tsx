import { useState } from 'react'
import {
  Alert,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useColorScheme } from '@mui/material/styles'
import { useTranslation } from '../i18n/useTranslation'
import { GoogleIcon } from './icons'
import { LanguageSwitch } from './LanguageSwitch'

interface SettingsViewProps {
  isGoogle: boolean
  accountEmail: string | null
  linkBusy: boolean
  linkError: string | null
  version: string
  logOutBusy: boolean
  logOutError: string | null
  onLinkGoogle: () => void
  onLogOut: () => void
  onChangeFlat: () => void
  // Only the owner can delete the home; the name is what they type to confirm
  isOwner: boolean
  flatName: string
  // Deleting reads everything from the server: it cannot be done without a connection
  online: boolean
  onDeleteFlat: () => void
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
  logOutBusy,
  logOutError,
  onLinkGoogle,
  onLogOut,
  onChangeFlat,
  isOwner,
  flatName,
  online,
  onDeleteFlat,
}: SettingsViewProps) => {
  const { t } = useTranslation()
  // MUI remembers the choice itself; until it is known the device decides
  const { mode, setMode } = useColorScheme()
  const [confirmingLogOut, setConfirmingLogOut] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [typedName, setTypedName] = useState('')
  const closeDelete = () => {
    setConfirmingDelete(false)
    setTypedName('')
  }

  return (
    <Stack spacing={3}>
      <Card variant="outlined" component="section" aria-label={t('settings.preferences')}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6" component="h2">
              {t('settings.preferences')}
            </Typography>
            <Stack spacing={1}>
              <Typography variant="subtitle2" component="h3">
                {t('common.language')}
              </Typography>
              <LanguageSwitch />
            </Stack>

            <Stack spacing={1}>
              <Typography variant="subtitle2" component="h3">
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
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" component="section" aria-label={t('settings.account')}>
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="h6" component="h2">
              {t('settings.account')}
            </Typography>
            {isGoogle ? (
              <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                <GoogleIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography>
                  {accountEmail
                    ? t('settings.linkedAs', { email: accountEmail })
                    : t('settings.linked')}
                </Typography>
              </Stack>
            ) : (
              <>
                <Typography color="text.secondary">{t('settings.notLinked')}</Typography>
                <Button
                  variant="outlined"
                  startIcon={<GoogleIcon />}
                  disabled={linkBusy}
                  onClick={onLinkGoogle}
                >
                  {linkBusy ? t('saveAccess.linking') : t('saveAccess.link')}
                </Button>
              </>
            )}
            {linkError ? <Alert severity="error">{linkError}</Alert> : null}
            <Button variant="outlined" onClick={onChangeFlat}>
              {t('flats.change')}
            </Button>
            <Button variant="outlined" color="error" onClick={() => setConfirmingLogOut(true)}>
              {t('settings.logOut')}
            </Button>
            <Dialog open={confirmingLogOut} onClose={() => setConfirmingLogOut(false)} fullWidth>
              <DialogTitle>{t('settings.logOut')}</DialogTitle>
              <DialogContent>
                <DialogContentText>
                  {isGoogle ? t('settings.logOutGoogle') : t('settings.logOutAnonymous')}
                </DialogContentText>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setConfirmingLogOut(false)}>{t('common.cancel')}</Button>
                <Button color="error" disabled={logOutBusy} onClick={onLogOut}>
                  {logOutBusy ? t('settings.loggingOut') : t('settings.logOutConfirm')}
                </Button>
              </DialogActions>
            </Dialog>
            {logOutError ? <Alert severity="error">{logOutError}</Alert> : null}
          </Stack>
        </CardContent>
      </Card>

      {isOwner ? (
        <Card variant="outlined" component="section" aria-label={t('settings.flat')}>
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="h6" component="h2">
                {t('settings.flat')}
              </Typography>
              <Button
                variant="outlined"
                color="error"
                disabled={!online}
                onClick={() => setConfirmingDelete(true)}
              >
                {t('settings.deleteFlat')}
              </Button>
              {online ? null : (
                <Typography variant="caption" color="text.secondary">
                  {t('settings.deleteFlatOffline')}
                </Typography>
              )}
              <Dialog open={confirmingDelete} onClose={closeDelete} fullWidth>
                <DialogTitle>{t('settings.deleteFlat')}</DialogTitle>
                <DialogContent>
                  <DialogContentText>
                    {t('settings.deleteFlatWarning', { name: flatName })}
                  </DialogContentText>
                  <TextField
                    autoFocus
                    fullWidth
                    margin="dense"
                    label={t('settings.deleteFlatType')}
                    value={typedName}
                    onChange={(event) => setTypedName(event.target.value)}
                    autoComplete="off"
                  />
                </DialogContent>
                <DialogActions>
                  <Button onClick={closeDelete}>{t('common.cancel')}</Button>
                  <Button
                    color="error"
                    disabled={typedName.trim() !== flatName || !online}
                    onClick={onDeleteFlat}
                  >
                    {t('settings.deleteFlatConfirm')}
                  </Button>
                </DialogActions>
              </Dialog>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <Typography variant="body2" color="text.secondary">
        {t('settings.version', { version })}
      </Typography>
    </Stack>
  )
}
