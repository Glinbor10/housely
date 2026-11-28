import { alpha } from '@mui/material/styles'
import { Box, Button, Stack, Typography } from '@mui/material'
import { m } from 'motion/react'
import { useTranslation } from '../i18n/useTranslation'
import type { MessageKey } from '../i18n/i18n'
import { GoogleIcon, PeopleIcon, ReceiptArrowsIcon, SparkleIcon } from './icons'
import { Mascot } from './Mascot'

interface WelcomeProps {
  onCreate: () => void
  onJoin: () => void
  onSignIn: () => void
  // A person who already has Google linked sees their homes at once: there is nothing to sign in to
  showSignIn?: boolean
  // When the person already has homes (switching), the screen is shorter: a small mascot and no pitch
  compact?: boolean
}

const SPRING = { type: 'spring', stiffness: 260, damping: 24 } as const

// What the app does, in three short lines
const POINTS: Array<{ icon: typeof SparkleIcon; text: MessageKey }> = [
  { icon: SparkleIcon, text: 'welcome.point.rotation' },
  { icon: ReceiptArrowsIcon, text: 'welcome.point.expenses' },
  { icon: PeopleIcon, text: 'welcome.point.code' },
]

export const Welcome = ({
  onCreate,
  onJoin,
  onSignIn,
  showSignIn = true,
  compact = false,
}: WelcomeProps) => {
  const { t } = useTranslation()
  return (
    <Stack
      sx={{
        minHeight: compact ? undefined : '88dvh',
        justifyContent: compact ? 'flex-start' : 'space-between',
        alignItems: 'center',
        textAlign: 'center',
        pt: compact ? 2 : 6,
        pb: compact ? 2 : 5,
      }}
    >
      <Stack spacing={compact ? 1.5 : 3} sx={{ alignItems: 'center', width: '100%' }}>
        <m.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...SPRING, delay: 0.05 }}
          style={{ position: 'relative' }}
        >
          {/* A soft glow behind the mascot */}
          <Box
            aria-hidden="true"
            sx={{
              position: 'absolute',
              inset: compact ? -16 : -36,
              borderRadius: '50%',
              background: (theme) =>
                `radial-gradient(closest-side, ${alpha(theme.palette.primary.main, 0.14)}, transparent)`,
            }}
          />
          <Box sx={{ position: 'relative' }}>
            <Mascot mood="happy" size={compact ? 96 : 180} />
          </Box>
        </m.div>
        <m.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.15 }}
        >
          <Stack spacing={1}>
            <Typography variant={compact ? 'h4' : 'h3'} component="h1">
              Housely
            </Typography>
            {compact ? null : (
              <Typography color="text.secondary">{t('welcome.tagline')}</Typography>
            )}
          </Stack>
        </m.div>
        {compact ? null : (
          <m.div
            style={{ width: '100%' }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.22 }}
          >
            <Stack
              component="ul"
              spacing={1.5}
              sx={{ listStyle: 'none', p: 0, m: 0, maxWidth: 320, mx: 'auto' }}
            >
              {POINTS.map(({ icon: Icon, text }) => (
                <Stack
                  key={text}
                  component="li"
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: 'center', textAlign: 'left' }}
                >
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 36,
                      height: 36,
                      flexShrink: 0,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14),
                      color: 'primary.main',
                    }}
                  >
                    <Icon fontSize="small" />
                  </Box>
                  <Typography variant="body2">{t(text)}</Typography>
                </Stack>
              ))}
            </Stack>
          </m.div>
        )}
      </Stack>
      <m.div
        style={{ width: '100%' }}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.28 }}
      >
        <Stack spacing={2} sx={{ pt: compact ? 2 : 4 }}>
          <Button variant="contained" size="large" onClick={onCreate}>
            {t('welcome.create')}
          </Button>
          <Button variant="outlined" size="large" onClick={onJoin}>
            {t('welcome.join')}
          </Button>
          {showSignIn ? (
            <Button startIcon={<GoogleIcon />} onClick={onSignIn}>
              {t('welcome.signIn')}
            </Button>
          ) : null}
        </Stack>
      </m.div>
    </Stack>
  )
}
