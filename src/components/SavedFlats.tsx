import { useState } from 'react'
import { alpha } from '@mui/material/styles'
import { Box, Button, Chip, Stack, Typography } from '@mui/material'
import { useTranslation } from '../i18n/useTranslation'
import { MIN_TOUCH_TARGET, SIZE } from '../theme'
import { ChevronDownIcon } from './icons'

interface SavedFlatItem {
  flatId: string
  name: string
}

interface SavedFlatsProps {
  flats: SavedFlatItem[]
  // The flat that is open now: it is marked and it cannot be opened again
  currentFlatId: string | null
  onOpen: (flatId: string) => void
}

const MAX_FLATS_SHOWN = 3

// The flats that this device already knows, shown on the start screen so a person can go back to one
export const SavedFlats = ({ flats, currentFlatId, onOpen }: SavedFlatsProps) => {
  const { t } = useTranslation()
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? flats : flats.slice(0, MAX_FLATS_SHOWN)
  return flats.length === 0 ? null : (
    <Stack spacing={1}>
      <Typography variant="h6" component="h2">
        {t('flats.device')}
      </Typography>
      <Stack component="ul" spacing={1} sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {visible.map((flat) => (
          <SavedFlatRow
            key={flat.flatId}
            flat={flat}
            current={flat.flatId === currentFlatId}
            onOpen={onOpen}
          />
        ))}
      </Stack>
      {flats.length > MAX_FLATS_SHOWN ? (
        <Button sx={{ alignSelf: 'center' }} onClick={() => setShowAll(!showAll)}>
          {showAll
            ? t('history.showLess')
            : t('history.showMore', { n: flats.length - MAX_FLATS_SHOWN })}
        </Button>
      ) : null}
    </Stack>
  )
}

interface SavedFlatRowProps {
  flat: SavedFlatItem
  current: boolean
  onOpen: (flatId: string) => void
}

const SavedFlatRow = ({ flat, current, onOpen }: SavedFlatRowProps) => {
  const { t } = useTranslation()
  return (
    <li>
      <Box
        component="button"
        type="button"
        aria-label={t('flats.open', { name: flat.name })}
        aria-current={current ? 'true' : undefined}
        onClick={() => onOpen(flat.flatId)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          width: '100%',
          minHeight: MIN_TOUCH_TARGET,
          p: 1.5,
          border: 2,
          borderRadius: 3,
          borderColor: current ? 'primary.main' : 'divider',
          bgcolor: (theme) =>
            current ? alpha(theme.palette.primary.main, 0.1) : theme.palette.background.paper,
          color: 'text.primary',
          font: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
          transition: 'border-color 0.15s, background-color 0.15s',
          '&:hover': { borderColor: 'primary.main' },
        }}
      >
        {/* The initial of the home, in a round badge */}
        <Box
          aria-hidden="true"
          sx={{
            width: SIZE.avatarMd,
            height: SIZE.avatarMd,
            flexShrink: 0,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 800,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.16),
            color: 'primary.main',
          }}
        >
          {(flat.name.trim().charAt(0) || '?').toUpperCase()}
        </Box>
        <Typography sx={{ fontWeight: 700, flexGrow: 1, overflowWrap: 'anywhere' }}>
          {flat.name || t('flats.unnamed')}
        </Typography>
        {current ? (
          <Chip size="small" color="primary" label={t('flats.current')} aria-hidden="true" />
        ) : (
          <ChevronDownIcon
            aria-hidden="true"
            sx={{ transform: 'rotate(-90deg)', color: 'text.secondary' }}
          />
        )}
      </Box>
    </li>
  )
}
