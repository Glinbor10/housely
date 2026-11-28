import type { ReactNode } from 'react'
import { m } from 'motion/react'

// Something that appears on the screen (a form, the next step of a form) grows from nothing and fades in,
// so the page does not jump. Reduced motion is honored by the MotionConfig of the app. The clipping
// lasts only while it grows, so focus rings and menus are never cut.
export const Reveal = ({ children }: { children: ReactNode }) => (
  <m.div
    initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
    animate={{ opacity: 1, height: 'auto', transitionEnd: { overflow: 'visible' } }}
    transition={{ duration: 0.22, ease: 'easeOut' }}
  >
    {children}
  </m.div>
)
