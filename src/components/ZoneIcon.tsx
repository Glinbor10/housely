import type { SvgIconProps } from '@mui/material'
import { zoneKind } from '../domain/zones'
import { BathIcon, KitchenIcon, SofaIcon, SparkleIcon } from './icons'

interface ZoneIconProps extends SvgIconProps {
  zone: string
}

// The symbol of a zone, next to its name: the three main ones have their own and any other gets the
// sparkle. It is decoration: the name next to it already says it.
export const ZoneIcon = ({ zone, ...props }: ZoneIconProps) => {
  const kind = zoneKind(zone)
  const Icon =
    kind === 'bathroom'
      ? BathIcon
      : kind === 'kitchen'
        ? KitchenIcon
        : kind === 'living'
          ? SofaIcon
          : SparkleIcon
  return <Icon aria-hidden="true" data-zone-kind={kind} {...props} />
}
