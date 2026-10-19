import type { SessionStorage } from './session'

const INSTALL_HINT_KEY = 'housely:install-hint-dismissed'

export const isInstallHintDismissed = (storage: SessionStorage): boolean => {
  try {
    return storage.getItem(INSTALL_HINT_KEY) === 'true'
  } catch {
    return false
  }
}

export const dismissInstallHint = (storage: SessionStorage): void => {
  try {
    storage.setItem(INSTALL_HINT_KEY, 'true')
  } catch {
    // Without storage the hint simply shows again next time.
  }
}
