import { useSyncExternalStore } from 'react'
import { getLocale, subscribeLocale, translate, type Locale, type MessageKey } from './i18n'

type Translate = (key: MessageKey, params?: Record<string, string | number>) => string

// Components re-render when the language changes. No effect needed: it is an external store.
export const useTranslation = (): { t: Translate; locale: Locale } => {
  const locale = useSyncExternalStore(subscribeLocale, getLocale)
  return { t: translate, locale }
}
