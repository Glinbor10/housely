// Shared spring presets — import from here instead of inlining values per component.
// Usage: transition={{ ...springFluid, delay: staggerDelay(i) }}

export const springSnappy = { type: 'spring', stiffness: 400, damping: 30 } as const
export const springFluid = { type: 'spring', stiffness: 260, damping: 24 } as const
export const springBounce = { type: 'spring', stiffness: 160, damping: 18 } as const

export const staggerDelay = (index: number, base = 0.05): number => index * base
