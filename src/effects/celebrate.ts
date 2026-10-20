export const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// A tiny tick in the hand: not supported on iOS Safari, where it is simply skipped.
export const buzz = (): void => {
  if (typeof navigator.vibrate === 'function') navigator.vibrate(15)
}

type Launch = () => void

// The confetti library is loaded only when it is needed, so it never weighs on the first load.
const launchConfetti: Launch = () => {
  void import('canvas-confetti').then(({ default: confetti }) => {
    const colors = ['#5b5bd6', '#ff8a5b', '#2bb673', '#ffd166']
    confetti({
      particleCount: 90,
      spread: 80,
      origin: { y: 0.7 },
      colors,
      disableForReducedMotion: true,
    })
  })
}

// Celebrates a clean week. People who asked for less motion get no confetti.
export const celebrate = async (launch: Launch = launchConfetti): Promise<void> => {
  if (!prefersReducedMotion()) launch()
}
