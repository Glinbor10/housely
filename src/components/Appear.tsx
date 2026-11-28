import type { ReactNode } from 'react'
import { m } from 'motion/react'

interface AppearProps {
  children: ReactNode
  // Only the items that join the list later move: the first ones are there from the start
  enabled?: boolean
}

// An item that joins a list later (the rest behind "show more") slides in with the same spring as the
// tabs. Reduced motion is honored by the MotionConfig of the app.
export const Appear = ({ children, enabled = true }: AppearProps) =>
  enabled ? (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
    >
      {children}
    </m.div>
  ) : (
    <div>{children}</div>
  )
