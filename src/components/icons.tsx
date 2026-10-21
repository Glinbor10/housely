import { SvgIcon, type SvgIconProps } from '@mui/material'

// Three tiny icons drawn here instead of pulling in an icon package: the app needs only these.
export const SparkleIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2z" />
    <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />
  </SvgIcon>
)

export const PeopleIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M16 11a3 3 0 100-6 3 3 0 000 6zm-8 0a3 3 0 100-6 3 3 0 000 6zm0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5c0-2.3-4.7-3.5-7-3.5zm8 0c-.3 0-.6 0-1 .1 1.2.8 2 2 2 3.4V19h6v-2.5c0-2.3-4.7-3.5-7-3.5z" />
  </SvgIcon>
)

export const HistoryIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M13 3a9 9 0 00-9 9H1l3.9 3.9.1.1L9 12H6a7 7 0 117 7 7 7 0 01-4.9-2l-1.4 1.4A9 9 0 1013 3zm-1 5v5l4.3 2.5.7-1.2-3.5-2V8H12z" />
  </SvgIcon>
)

export const HomeIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z" />
  </SvgIcon>
)
