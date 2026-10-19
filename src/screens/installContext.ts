import type { InstallContext } from '../pwa/installHint'

// Reads what the browser says about itself; kept apart so the decision stays a pure function.
export const readInstallContext = (dismissed: boolean): InstallContext => ({
  userAgent: navigator.userAgent,
  platform: navigator.platform,
  maxTouchPoints: navigator.maxTouchPoints,
  standalone:
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    (window.matchMedia?.('(display-mode: standalone)').matches ?? false),
  dismissed,
})
