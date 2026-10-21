import { Box, Typography } from '@mui/material'

interface ProgressRingProps {
  done: number
  total: number
  size?: number
}

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// The week at a glance. The ring fills with a smooth transition, switched off for people who asked
// for less motion.
export const ProgressRing = ({ done, total, size = 132 }: ProgressRingProps) => {
  const fraction = total === 0 ? 0 : Math.min(1, done / total)
  const complete = total > 0 && done >= total
  return (
    <Box
      role="progressbar"
      aria-label="Progress of the week"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fraction * 100)}
      sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
    >
      <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          strokeWidth="12"
          stroke="currentColor"
          opacity={0.12}
        />
        <Box
          component="circle"
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          transform="rotate(-90 60 60)"
          sx={{
            stroke: (theme) => (complete ? theme.palette.success.main : theme.palette.primary.main),
            transition: 'stroke-dashoffset 700ms cubic-bezier(0.34, 1.56, 0.64, 1), stroke 300ms',
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          }}
        />
      </svg>
      <Typography
        component="span"
        variant="h5"
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          fontWeight: 800,
        }}
      >
        {done}/{total}
      </Typography>
    </Box>
  )
}
