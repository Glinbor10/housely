import { useState } from 'react'
import {
  Button,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Snackbar,
} from '@mui/material'
import { useTranslation } from '../i18n/useTranslation'
import { CopyIcon, MailIcon, ShareIcon, TelegramIcon, WhatsAppIcon } from './icons'

interface ShareButtonProps {
  // The text that is sent: the same whatever the app it goes through
  message: string
  // The address of the app, when the message carries one (the share sheet of the phone sends it apart)
  url?: string
  // What the button says, so it is clear what is shared before pressing it ("Share rotation")
  label: string
  // A small button with only the icon (the label is then its name for assistive technology)
  iconOnly?: boolean
  variant?: 'text' | 'outlined' | 'contained'
  fullWidth?: boolean
  size?: 'small' | 'medium' | 'large'
}

type Feedback = 'copied' | 'manual' | null

// The one way to share in the app. The phone has its own share sheet (WhatsApp, Telegram, Messages...):
// it is used when there is one. Without it (a computer) a small menu offers WhatsApp, Telegram, email
// and copying the text.
export const ShareButton = ({
  message,
  url,
  label,
  iconOnly = false,
  variant = 'text',
  fullWidth = false,
  size = 'medium',
}: ShareButtonProps) => {
  const { t } = useTranslation()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)

  const share = async (button: HTMLElement) => {
    if (typeof navigator.share !== 'function') {
      setAnchor(button)
      return
    }
    try {
      await navigator.share({ title: 'Housely', text: message, ...(url ? { url } : {}) })
    } catch (error) {
      // Closing the share sheet is not an error; any other failure falls back to the menu
      if (!(error instanceof DOMException && error.name === 'AbortError')) setAnchor(button)
    }
  }

  const copy = async () => {
    setAnchor(null)
    try {
      if (!navigator.clipboard) throw new Error('no clipboard')
      await navigator.clipboard.writeText(message)
      setFeedback('copied')
    } catch {
      setFeedback('manual')
    }
  }

  const text = encodeURIComponent(message)
  const pageUrl = encodeURIComponent(url ?? window.location.origin)

  return (
    <>
      {iconOnly ? (
        <IconButton
          aria-label={label}
          aria-haspopup="menu"
          size={size}
          onClick={(event) => void share(event.currentTarget)}
        >
          <ShareIcon />
        </IconButton>
      ) : (
        <Button
          aria-haspopup="menu"
          variant={variant}
          size={size}
          fullWidth={fullWidth}
          startIcon={<ShareIcon />}
          onClick={(event) => void share(event.currentTarget)}
        >
          {label}
        </Button>
      )}
      <Menu
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        slotProps={{ list: { 'aria-label': t('share.options') } }}
      >
        <MenuItem
          component="a"
          href={`https://wa.me/?text=${text}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setAnchor(null)}
        >
          <ListItemIcon>
            <WhatsAppIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('share.whatsapp')}</ListItemText>
        </MenuItem>
        <MenuItem
          component="a"
          href={`https://t.me/share/url?url=${pageUrl}&text=${text}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setAnchor(null)}
        >
          <ListItemIcon>
            <TelegramIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('share.telegram')}</ListItemText>
        </MenuItem>
        <MenuItem
          component="a"
          href={`mailto:?subject=Housely&body=${text}`}
          onClick={() => setAnchor(null)}
        >
          <ListItemIcon>
            <MailIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('share.email')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => void copy()}>
          <ListItemIcon>
            <CopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('share.copy')}</ListItemText>
        </MenuItem>
      </Menu>
      <Snackbar
        open={feedback !== null}
        autoHideDuration={4000}
        onClose={() => setFeedback(null)}
        message={feedback === 'copied' ? t('share.copied') : t('share.manual', { message })}
        sx={{ bottom: { xs: 84 } }}
      />
    </>
  )
}
