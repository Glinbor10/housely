import { translate, type MessageKey } from './i18n'

// An error that knows how to say itself in every language: the layers that throw it (Firebase,
// domain) stay free of any screen, and the screen translates it where it is shown.
export interface LocalizedError extends Error {
  messageKey: MessageKey
  messageParams?: Record<string, string | number>
}

const isLocalized = (error: unknown): error is LocalizedError =>
  error instanceof Error && 'messageKey' in error

export const describeError = (error: unknown): string =>
  isLocalized(error)
    ? translate(error.messageKey, error.messageParams)
    : error instanceof Error && error.message
      ? error.message
      : translate('common.somethingWentWrong')
