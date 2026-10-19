export interface InstallContext {
  userAgent: string
  platform: string
  maxTouchPoints: number
  // True when the app already runs from the home screen
  standalone: boolean
  dismissed: boolean
}

// iPads report themselves as a Mac: the touch screen tells them apart from a real desktop.
const isIos = ({ userAgent, platform, maxTouchPoints }: InstallContext): boolean =>
  /iPhone|iPad|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1)

// Safari deletes the data of websites not used for 7 days unless they are installed, which would
// lose the identity of the device. Android installs from the browser prompt, so only iOS needs a hint.
export const shouldSuggestInstall = (context: InstallContext): boolean =>
  isIos(context) && !context.standalone && !context.dismissed
