import { SvgIcon, type SvgIconProps } from '@mui/material'

// Three tiny icons drawn here instead of pulling in an icon package: the app needs only these.
export const SparkleIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2z" />
    <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />
  </SvgIcon>
)

// A receipt: the expenses of the flat. Drawn here on purpose, it is not the logo of any brand.
export const ReceiptIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M4 2h16v20l-3-2-3 2-2-2-2 2-3-2-3 2V2zm4 5h8v2H8V7zm0 4h8v2H8v-2zm0 4h5v2H8v-2z" />
  </SvgIcon>
)

export const HistoryIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M13 3a9 9 0 00-9 9H1l3.9 3.9.1.1L9 12H6a7 7 0 117 7 7 7 0 01-4.9-2l-1.4 1.4A9 9 0 1013 3zm-1 5v5l4.3 2.5.7-1.2-3.5-2V8H12z" />
  </SvgIcon>
)

export const SettingsIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
  </SvgIcon>
)

export const HomeIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z" />
  </SvgIcon>
)
