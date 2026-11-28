// What went wrong in production, without saying anything about who it happened to. A report holds only
// where the error came from, its type and its code: never its message, which can carry the name of a
// person, an email, an identity or the name of a home. With no sink (tests, emulators, local work) it
// does nothing, and it never writes to Firestore, so it costs none of its quota.

export type ErrorKind = 'uncaught' | 'rejection' | 'firestore'

export interface ErrorReport {
  kind: ErrorKind
  // The type of the error, such as TypeError or FirebaseError
  name: string
  // The code of a Firebase error without its service ("permission-denied"), "none" or "other"
  code: string
}

export type ReportSink = (report: ErrorReport) => void

// The Firestore errors that mean something is wrong in production: rules that reject the app, or the
// free quota used up. Being offline is normal and is not reported.
const FIRESTORE_CODES = new Set(['permission-denied', 'resource-exhausted'])

// A plain identifier: anything else could be text written by a person
const ERROR_NAME = /^[A-Za-z]{1,40}$/
const ERROR_CODE = /^[a-z][a-z-]{0,39}$/

let sink: ReportSink | undefined

export const setReportSink = (next: ReportSink | undefined): void => {
  sink = next
}

const codeOf = (error: unknown): string => {
  const code = (error as { code?: unknown } | null)?.code
  if (typeof code !== 'string') return 'none'
  const bare = code.slice(code.lastIndexOf('/') + 1)
  return ERROR_CODE.test(bare) ? bare : 'other'
}

export const toReport = (kind: ErrorKind, error: unknown): ErrorReport => {
  if (!(error instanceof Error)) return { kind, name: 'NotAnError', code: 'none' }
  return { kind, name: ERROR_NAME.test(error.name) ? error.name : 'Error', code: codeOf(error) }
}

export const reportError = (kind: ErrorKind, error: unknown): void => {
  if (sink === undefined) return
  try {
    sink(toReport(kind, error))
  } catch {
    // Reporting must never be the reason the app fails
  }
}

export const reportFirestoreError = (error: unknown): void => {
  const report = toReport('firestore', error)
  if (FIRESTORE_CODES.has(report.code)) reportError('firestore', error)
}

// Errors nobody caught and promises nobody handled: the bugs we would not hear about otherwise
export const watchUncaughtErrors = (target: EventTarget): (() => void) => {
  const onError = (event: Event) => reportError('uncaught', (event as ErrorEvent).error)
  const onRejection = (event: Event) =>
    reportError('rejection', (event as PromiseRejectionEvent).reason)
  target.addEventListener('error', onError)
  target.addEventListener('unhandledrejection', onRejection)
  return () => {
    target.removeEventListener('error', onError)
    target.removeEventListener('unhandledrejection', onRejection)
  }
}
