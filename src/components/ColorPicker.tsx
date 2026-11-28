import { MIN_TOUCH_TARGET } from '../theme'
import { Box, Stack } from '@mui/material'
import { readableOn } from '../domain/color'
import { PERSON_COLORS } from '../domain/palette'
import { useTranslation } from '../i18n/useTranslation'

interface ColorPickerProps {
  // The color that is chosen now
  value: string
  // Colors that somebody else already has, with their name: they are not offered, so two people do
  // not share one
  takenBy: Record<string, string>
  busy: boolean
  onChange: (hex: string) => void
}

// Where a person chooses their own color. Only the colors that nobody else has are shown (and their
// own). Every swatch is a button with the name of the color, so it does not depend on seeing it, and
// the chosen one carries a check as well as a ring.
export const ColorPicker = ({ value, takenBy, busy, onChange }: ColorPickerProps) => {
  const { t } = useTranslation()
  // When every other color is taken (a flat with more people than colors) nobody is left without a choice
  const free = PERSON_COLORS.filter((color) => color.hex !== value && !takenBy[color.hex])
  const offered =
    free.length === 0
      ? PERSON_COLORS
      : PERSON_COLORS.filter((color) => color.hex === value || !takenBy[color.hex])
  return (
    <Stack
      role="group"
      aria-label={t('people.yourColor')}
      direction="row"
      sx={{ flexWrap: 'wrap', gap: 1 }}
    >
      {offered.map(({ id, hex }) => {
        const name = t(`color.${id}`)
        const chosen = hex === value
        return (
          <Box
            key={hex}
            component="button"
            type="button"
            aria-label={name}
            aria-pressed={chosen}
            disabled={busy}
            onClick={() => (chosen ? undefined : onChange(hex))}
            sx={{
              width: MIN_TOUCH_TARGET,
              height: MIN_TOUCH_TARGET,
              borderRadius: '50%',
              border: 3,
              borderColor: chosen ? 'text.primary' : 'transparent',
              bgcolor: hex,
              color: readableOn(hex),
              font: 'inherit',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              '&:disabled': { cursor: 'not-allowed', opacity: 0.7 },
              '&:focus-visible': {
                outline: '3px solid',
                outlineColor: 'primary.main',
                outlineOffset: 2,
              },
            }}
          >
            {chosen ? '✓' : null}
          </Box>
        )
      })}
    </Stack>
  )
}
