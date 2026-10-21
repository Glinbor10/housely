import { Box } from '@mui/material'
import { keyframes } from '@mui/material/styles'
import type { Mood } from '../domain/mood'

const LABELS: Record<Mood, string> = {
  sleepy: 'Housy the mascot, sleeping',
  happy: 'Housy the mascot, smiling',
  party: 'Housy the mascot, celebrating',
}

const breathe = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
`
const bounce = keyframes`
  0%, 100% { transform: translateY(0) rotate(0deg); }
  30% { transform: translateY(-10%) rotate(-4deg); }
  60% { transform: translateY(0) rotate(3deg); }
`

const ANIMATIONS: Record<Mood, string> = {
  sleepy: `${breathe} 3.2s ease-in-out infinite`,
  happy: `${breathe} 2s ease-in-out infinite`,
  party: `${bounce} 0.9s ease-in-out infinite`,
}

const STROKE = { stroke: '#fff', strokeWidth: 5, strokeLinecap: 'round', fill: 'none' } as const

const Face = ({ mood }: { mood: Mood }) =>
  mood === 'sleepy' ? (
    <g {...STROKE}>
      <path d="M38 80 q8 7 16 0" />
      <path d="M66 80 q8 7 16 0" />
      <path d="M52 96 h16" />
      <path d="M92 40 h10 l-10 12 h10" strokeWidth={3} stroke="#ffd166" />
    </g>
  ) : mood === 'happy' ? (
    <g>
      <circle cx="46" cy="78" r="7" fill="#fff" />
      <circle cx="74" cy="78" r="7" fill="#fff" />
      <circle cx="47" cy="79" r="3.5" fill="#2b2b45" />
      <circle cx="75" cy="79" r="3.5" fill="#2b2b45" />
      <path d="M48 94 q12 12 24 0" {...STROKE} />
    </g>
  ) : (
    <g>
      <path d="M38 82 q8 -12 16 0" {...STROKE} />
      <path d="M66 82 q8 -12 16 0" {...STROKE} />
      <path d="M46 92 q14 20 28 0 z" fill="#fff" />
      <path d="M52 14 l8 -12 l8 12 z" fill="#ffd166" />
      <circle cx="60" cy="2" r="3" fill="#ff8a5b" />
    </g>
  )

interface MascotProps {
  mood: Mood
  size?: number
  // Hide it from assistive technology when the text next to it already says the same
  decorative?: boolean
}

// Housy: a little house with a face whose mood follows the week. It is drawn here, as plain SVG, so
// it is light, sharp at any size and can change with the state of the week.
export const Mascot = ({ mood, size = 120, decorative = false }: MascotProps) => (
  <Box
    component="svg"
    viewBox="0 0 120 120"
    width={size}
    height={size}
    {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': LABELS[mood] })}
    sx={{
      overflow: 'visible',
      transformOrigin: '50% 90%',
      animation: ANIMATIONS[mood],
      '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
    }}
  >
    <path
      d="M14 60 L60 18 L106 60"
      fill="#ff8a5b"
      stroke="#ff8a5b"
      strokeWidth={12}
      strokeLinejoin="round"
    />
    <rect x="22" y="54" width="76" height="58" rx="22" fill="#5b5bd6" />
    <Face mood={mood} />
  </Box>
)
