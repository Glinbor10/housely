import { alpha } from '@mui/material/styles'
import { Box } from '@mui/material'

// The background of the first screens: soft colors that fill the whole window, light or dark, not a
// gradient in a box. It sits behind everything and never takes a click.
export const StartBackdrop = () => (
  <Box
    aria-hidden="true"
    sx={{
      position: 'fixed',
      inset: 0,
      zIndex: -1,
      pointerEvents: 'none',
      // A Stack puts a margin on its children, and that would shift a fixed box
      '&&': { m: 0 },
      background: (theme) =>
        [
          `radial-gradient(70% 45% at 10% 0%, ${alpha(theme.palette.primary.main, 0.12)} 0%, transparent 70%)`,
          `radial-gradient(60% 40% at 100% 38%, ${alpha(theme.palette.secondary.main, 0.1)} 0%, transparent 70%)`,
          `radial-gradient(80% 50% at 0% 100%, ${alpha(theme.palette.primary.main, 0.08)} 0%, transparent 70%)`,
          theme.palette.background.default,
        ].join(', '),
    }}
  />
)
