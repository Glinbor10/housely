import { SvgIcon, useTheme, type SvgIconProps } from '@mui/material'

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

// WhatsApp logo: circle outline + phone handset, used on the settlement share button
export const WhatsAppIcon = (props: SvgIconProps) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.06L2 22l5.09-1.35A9.94 9.94 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18a7.96 7.96 0 01-4.07-1.12l-.29-.17-3.02.8.82-2.96-.19-.3A7.96 7.96 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"
    />
    <path d="M17.5 14.4c-.3-.15-1.74-.86-2.01-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.95 1.16-.17.2-.35.22-.65.07-1.63-.81-2.7-1.45-3.77-3.28-.29-.5.29-.46.83-1.54.09-.2.05-.37-.03-.52l-.9-2.18c-.24-.58-.48-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.09 3.19 5.07 4.48.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.74-.71 1.99-1.4.24-.69.24-1.28.17-1.4-.07-.12-.27-.2-.57-.34z" />
  </SvgIcon>
)

// Two coins that overlap: an expense that is split between people
export const SplitIcon = (props: SvgIconProps) => (
  <SvgIcon data-testid="split-icon" {...props}>
    <circle cx="9" cy="12" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
    <circle cx="15" cy="12" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
  </SvgIcon>
)

// An arrow leaving a square: the link opens somewhere else
export const ExternalLinkIcon = (props: SvgIconProps) => (
  <SvgIcon data-testid="external-link-icon" {...props}>
    <path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
  </SvgIcon>
)

// A bin: delete
export const TrashIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
  </SvgIcon>
)

// An arrow to the right: money going from one person to another
export const ArrowRightIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
  </SvgIcon>
)

// A tick: done
export const CheckIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
  </SvgIcon>
)

// A cross: not done
export const CloseIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </SvgIcon>
)

// A pencil: edit
export const EditIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 000-1.41l-2.34-2.34a.996.996 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
  </SvgIcon>
)

export const HomeIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z" />
  </SvgIcon>
)

// Two person silhouettes (group) + euro sign: the flat tab (members + expenses)
export const FlatIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path
      transform="scale(0.75)"
      d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
    />
    <path
      transform="translate(12.5,13) scale(0.5)"
      d="M15 18.5c-2.51 0-4.68-1.42-5.76-3.5H15v-2H8.58c-.05-.33-.08-.66-.08-1s.03-.67.08-1H15V9H9.24C10.32 6.92 12.5 5.5 15 5.5c1.61 0 3.09.59 4.23 1.57L21 5.3C19.41 3.87 17.3 3 15 3c-3.92 0-7.24 2.51-8.48 6H3v2h3.06c-.04.33-.06.66-.06 1 0 .34.02.67.06 1H3v2h3.52c1.24 3.49 4.56 6 8.48 6 2.31 0 4.41-.87 6-2.3l-1.78-1.77c-1.13.98-2.6 1.57-4.22 1.57z"
    />
  </SvgIcon>
)

// Two person silhouettes: the people/members tab
export const PeopleIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </SvgIcon>
)

// A bathtub with a tap: the bathroom
export const BathIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M7 3a3 3 0 013 3v3H8V6a1 1 0 00-2 0v3H4V6a3 3 0 013-3z" />
    <path d="M2 11h20v2a6 6 0 01-4 5.66V21h-2v-2H8v2H6v-2.34A6 6 0 012 13v-2z" />
  </SvgIcon>
)

// A cooking pot with its lid: the kitchen
export const KitchenIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M9.5 4h5a1.5 1.5 0 011.5 1.5V7H8V5.5A1.5 1.5 0 019.5 4z" />
    <path d="M3 9h18v2h-1v6a3 3 0 01-3 3H7a3 3 0 01-3-3v-6H3V9z" />
  </SvgIcon>
)

// A sofa: the living room
export const SofaIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v4h-2V5H7v4H5V5zM2 11a2 2 0 014 0v1h12v-1a2 2 0 114 0v8h-2v-2H4v2H2v-8z" />
  </SvgIcon>
)

// A node with two arrows leaving it: share
export const ShareIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" />
  </SvgIcon>
)

// A paper plane: Telegram
export const TelegramIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
  </SvgIcon>
)

// An envelope: email
export const MailIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
  </SvgIcon>
)

// Two sheets: copy
export const CopyIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
  </SvgIcon>
)

// An artist palette: choose a color
export const PaletteIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M12 3a9 9 0 000 18c1.1 0 2-.9 2-2 0-.52-.2-.98-.52-1.33-.31-.35-.48-.8-.48-1.28 0-1.1.9-2 2-2h2.35c2.1 0 3.65-1.65 3.65-3.7C21 6.62 17.03 3 12 3zM6.5 12a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3-4a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3 4a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
  </SvgIcon>
)

// Three dots in a column: more options of an item
export const MoreIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M12 8a2 2 0 100-4 2 2 0 000 4zm0 2a2 2 0 100 4 2 2 0 000-4zm0 6a2 2 0 100 4 2 2 0 000-4z" />
  </SvgIcon>
)

// The letter G of Google, in one ink: the person has a Google account linked
export const GoogleIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z" />
  </SvgIcon>
)

// G of Google (75 %) + warning triangle badge in the bottom-right corner: Google not linked
export const GoogleWarningIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <g transform="scale(0.75)">
      <path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z" />
    </g>
    {/* Warning triangle badge; always orange regardless of theme */}
    <g transform="translate(12,12) scale(0.5)" fill="#ed6c02">
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
    </g>
  </SvgIcon>
)

// A triangle with an exclamation mark: something to pay attention to
export const WarningIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
  </SvgIcon>
)

// A receipt with an arrow up and an arrow down inside: the expenses and who is owed or owes. By default it
// has one ink, like the other icons; with `colored` the arrows are green (up) and red (down).
export const ReceiptArrowsIcon = ({
  colored = false,
  ...props
}: SvgIconProps & { colored?: boolean }) => {
  const theme = useTheme()
  return (
    <SvgIcon {...props}>
      <path
        fillRule="evenodd"
        d="M4 2h16v20l-3-2-3 2-2-2-2 2-3-2-3 2V2zM8.5 5.5L5.3 9.2h2.4V14h1.6V9.2h2.4L8.5 5.5z M15.5 18.5l3.2-3.7h-2.4V10h-1.6v4.8h-2.4l3.2 3.7z"
      />
      {colored ? (
        <>
          <path
            d="M8.5 5.5L5.3 9.2h2.4V14h1.6V9.2h2.4L8.5 5.5z"
            fill={theme.palette.success.main}
          />
          <path
            d="M15.5 18.5l3.2-3.7h-2.4V10h-1.6v4.8h-2.4l3.2 3.7z"
            fill={theme.palette.error.main}
          />
        </>
      ) : null}
    </SvgIcon>
  )
}

// A suitcase with a handle: away from home
export const SuitcaseIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M9 2h6v2H9V2zM4 6h16a2 2 0 012 2v11a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" />
  </SvgIcon>
)

// Two arrows, one each way: a swap
export const SwapIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z" />
  </SvgIcon>
)

// A small arrow that points down: a menu opens from here
export const ChevronDownIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z" />
  </SvgIcon>
)

// A crescent moon: rest
export const MoonIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M12.43 2.3c-2.38-.59-4.68-.27-6.63.64-.35.16-.41.64-.1.86C8.3 5.6 10 8.6 10 12c0 3.4-1.7 6.4-4.3 8.2-.32.22-.26.7.09.86 1.28.6 2.71.94 4.21.94 6.05 0 10.85-5.38 9.87-11.6-.61-3.92-3.59-7.16-7.44-8.1z" />
  </SvgIcon>
)
