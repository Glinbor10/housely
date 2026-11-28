import { useId } from 'react'
import { Box } from '@mui/material'
import { keyframes } from '@mui/material/styles'
import type { Mood } from '../domain/mood'
import { useTranslation } from '../i18n/useTranslation'

const breathe = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
`
const hop = keyframes`
  0%, 100% { transform: translateY(0) rotate(0deg); }
  30% { transform: translateY(-9%) rotate(-4deg); }
  60% { transform: translateY(0) rotate(3deg); }
`
const shake = keyframes`
  0%, 70%, 100% { transform: translateX(0); }
  78% { transform: translateX(-3%); }
  86% { transform: translateX(3%); }
  94% { transform: translateX(-2%); }
`
const sag = keyframes`
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(0.965); }
`
const rage = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1.03); }
  25% { transform: translate(-1.8%, 0.8%) scale(1.03); }
  50% { transform: translate(1.8%, -0.8%) scale(1.03); }
  75% { transform: translate(-1.2%, -0.6%) scale(1.03); }
`

const ANIMATIONS: Record<Mood, string> = {
  sleepy: `${breathe} 3.6s ease-in-out infinite`,
  happy: `${breathe} 2.2s ease-in-out infinite`,
  party: `${hop} 0.9s ease-in-out infinite`,
  worried: `${shake} 1.7s ease-in-out infinite`,
  sad: `${sag} 3.4s ease-in-out infinite`,
  angry: `${rage} 0.34s linear infinite`,
}

// Palette: navy body, sky blue roof, amber feet. Angry turns the body red.
const INK = '#101a33'
const NAVY = '#1f3a70'
const ROOF = '#5aa2f0'
const CHIMNEY = '#3d86d6'
const AMBER = '#ffc24a'
const RED = '#b3283f'

const EYE_Y = 122
const EYE_R = 23

type Point = [number, number]
const mirror = (points: Point[]): Point[] => points.map(([x, y]) => [200 - x, y])
const toPoints = (points: Point[]): string => points.map((point) => point.join(',')).join(' ')

// The emotion lives in the eyelids: flat shapes in the color of the body, clipped to the eye.
const LIDS: Partial<Record<Mood, Point[]>> = {
  worried: [
    [54, 112],
    [100, 96],
    [100, 80],
    [54, 80],
  ],
  sad: [
    [54, 118],
    [100, 94],
    [100, 80],
    [54, 80],
  ],
  angry: [
    [54, 94],
    [100, 119],
    [100, 80],
    [54, 80],
  ],
}
// Where the pupil looks: x (towards the nose), y, radius
const PUPILS: Partial<Record<Mood, [number, number, number]>> = {
  happy: [1, -1, 11],
  worried: [-4, -6, 11],
  sad: [0, 7, 11],
  angry: [3, 5, 9],
}

interface EyeProps {
  side: 'left' | 'right'
  mood: Mood
  bodyColor: string
  clipId: string
}

const Eye = ({ side, mood, bodyColor, clipId }: EyeProps) => {
  const cx = side === 'left' ? 78 : 122
  const direction = side === 'left' ? 1 : -1
  if (mood === 'sleepy') {
    return (
      <path
        d={`M${cx - 19} ${EYE_Y - 2} q19 17 38 0`}
        fill="none"
        stroke={INK}
        strokeWidth="6"
        strokeLinecap="round"
      />
    )
  }
  if (mood === 'party') {
    return (
      <path
        d={`M${cx - 19} ${EYE_Y + 6} q19 -24 38 0`}
        fill="none"
        stroke={INK}
        strokeWidth="6.5"
        strokeLinecap="round"
      />
    )
  }
  const [px, py, radius] = PUPILS[mood] ?? [0, 0, 11]
  const lid = LIDS[mood]
  const lidPoints = lid ? (side === 'left' ? lid : mirror(lid)) : undefined
  const edge = lidPoints ? [lidPoints[0], lidPoints[1]] : undefined
  const pupilX = cx + px * direction
  return (
    <>
      <circle cx={cx} cy={EYE_Y} r={EYE_R} fill="#fff" />
      <circle cx={pupilX} cy={EYE_Y + py} r={radius} fill={INK} />
      <circle cx={pupilX + 4} cy={EYE_Y + py - 4.5} r="4.2" fill="#fff" />
      <circle cx={pupilX - 3.5} cy={EYE_Y + py + 4} r="1.9" fill="#fff" />
      {lidPoints && edge ? (
        <>
          <clipPath id={clipId}>
            <circle cx={cx} cy={EYE_Y} r={EYE_R} />
          </clipPath>
          <g clipPath={`url(#${clipId})`}>
            <polygon points={toPoints(lidPoints)} fill={bodyColor} />
            <line
              x1={edge[0][0]}
              y1={edge[0][1]}
              x2={edge[1][0]}
              y2={edge[1][1]}
              stroke={INK}
              strokeWidth={mood === 'angry' ? 6 : 4}
              strokeLinecap="round"
            />
          </g>
        </>
      ) : null}
    </>
  )
}

const Mouth = ({ mood }: { mood: Mood }) =>
  mood === 'happy' ? (
    <path d="M86 160 q14 13 28 0" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
  ) : mood === 'sleepy' ? (
    <ellipse cx="100" cy="164" rx="4.5" ry="6" fill={INK} />
  ) : mood === 'party' ? (
    <>
      <path
        d="M80 154 q20 34 40 0 z"
        fill={INK}
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <ellipse cx="100" cy="171" rx="9.5" ry="5.5" fill="#ff7a8a" />
    </>
  ) : mood === 'worried' ? (
    <path
      d="M86 164 q7 -7 14 0 t14 0"
      fill="none"
      stroke={INK}
      strokeWidth="4.5"
      strokeLinecap="round"
    />
  ) : mood === 'sad' ? (
    <path d="M86 170 q14 -13 28 0" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
  ) : (
    <>
      <rect x="81" y="156" width="38" height="17" rx="6" fill="#fff" stroke={INK} strokeWidth="4" />
      <path d="M90.5 157 v15 M100 157 v15 M109.5 157 v15" stroke={INK} strokeWidth="2.6" />
    </>
  )

const PartyHat = () => (
  <g transform="translate(104 38) rotate(-9)">
    <path d="M-17 2 L0 -42 L17 2 Z" fill="#ffd23f" />
    <path d="M-10 -15 h20" stroke="#ff6b6b" strokeWidth="4.5" strokeLinecap="round" />
    <circle cx="0" cy="-44" r="5.5" fill="#ff6b6b" />
  </g>
)

const Confetti = () => (
  <>
    <rect x="14" y="52" width="9" height="9" rx="2" fill="#ff6b6b" transform="rotate(20 18 56)" />
    <circle cx="182" cy="58" r="5" fill="#ffd23f" />
    <rect
      x="176"
      y="150"
      width="9"
      height="9"
      rx="2"
      fill="#35b7c9"
      transform="rotate(-25 180 154)"
    />
    <circle cx="18" cy="150" r="5" fill="#5aa2f0" />
    <rect x="150" y="12" width="8" height="8" rx="2" fill="#3fbf7f" transform="rotate(35 154 16)" />
    <circle cx="42" cy="18" r="4" fill="#ff9d78" />
  </>
)

const Sleep = () => (
  <g stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M154 54 h14 l-14 16 h14" />
    <path d="M176 28 h10 l-10 12 h10" strokeWidth="3" />
  </g>
)

interface MascotProps {
  mood: Mood
  size?: number
  // Hide it from assistive technology when the text next to it already says the same
  decorative?: boolean
}

// Housy: a little house with feet and big eyes whose mood follows the week. It is drawn here, as
// plain SVG, so it is light, sharp at any size and can change with what happens in the flat.
export const Mascot = ({ mood, size = 120, decorative = false }: MascotProps) => {
  const { t } = useTranslation()
  // Every instance needs its own ids: two faces on one page must not share an eyelid
  const id = useId().replace(/:/g, '')
  const body = mood === 'angry' ? RED : NAVY

  return (
    <Box
      component="svg"
      viewBox="0 0 200 200"
      width={size}
      height={size}
      {...(decorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': t(`mascot.${mood}`) })}
      sx={{
        overflow: 'visible',
        color: '#6b7fa6',
        transformBox: 'fill-box',
        transformOrigin: '50% 92%',
        animation: ANIMATIONS[mood],
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
      }}
    >
      {mood === 'party' ? <Confetti /> : null}
      <ellipse data-part="foot" cx="76" cy="190" rx="16" ry="7" fill={AMBER} />
      <ellipse data-part="foot" cx="124" cy="190" rx="16" ry="7" fill={AMBER} />
      <rect x="132" y="36" width="22" height="44" rx="6" fill={CHIMNEY} />
      <path
        d="M26 98 L100 32 L174 98 Z"
        fill={ROOF}
        stroke={ROOF}
        strokeWidth="14"
        strokeLinejoin="round"
      />
      <rect data-part="body" x="38" y="86" width="124" height="104" rx="42" fill={body} />
      <Eye side="left" mood={mood} bodyColor={body} clipId={`${id}-l`} />
      <Eye side="right" mood={mood} bodyColor={body} clipId={`${id}-r`} />
      <Mouth mood={mood} />
      {mood === 'party' ? <PartyHat /> : null}
      {mood === 'sleepy' ? <Sleep /> : null}
      {mood === 'worried' ? <path d="M166 108 q-10 16 0 21 q10 -5 0 -21z" fill="#7cc7ff" /> : null}
      {mood === 'sad' ? <path d="M52 140 q-9 14 0 20 q9 -6 0 -20z" fill="#7cc7ff" /> : null}
    </Box>
  )
}
