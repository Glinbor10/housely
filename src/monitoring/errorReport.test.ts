// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  reportError,
  reportFirestoreError,
  setReportSink,
  toReport,
  watchUncaughtErrors,
  type ErrorReport,
} from './errorReport'

const firestoreError = (code: string, message: string) =>
  Object.assign(new Error(message), { name: 'FirebaseError', code })

afterEach(() => setReportSink(undefined))

describe('toReport', () => {
  it('keeps only the kind, the type of the error and its code', () => {
    const report = toReport('firestore', firestoreError('permission-denied', 'no access'))
    expect(report).toEqual({ kind: 'firestore', name: 'FirebaseError', code: 'permission-denied' })
  })

  it('never carries the message, which may hold names, emails or the name of a home', () => {
    const error = new TypeError('Cannot read "Piso Calle Luna" of ana@example.com uid-123')
    const report = toReport('uncaught', error)
    expect(JSON.stringify(report)).not.toMatch(/Piso|ana@example|uid-123|Cannot read/)
    expect(report).toEqual({ kind: 'uncaught', name: 'TypeError', code: 'none' })
  })

  it('does not trust a name or a code that is not a plain identifier', () => {
    const odd = Object.assign(new Error('x'), { name: 'Ana García', code: 'ana@example.com' })
    expect(toReport('rejection', odd)).toEqual({ kind: 'rejection', name: 'Error', code: 'other' })
    expect(toReport('rejection', 'just a string')).toEqual({
      kind: 'rejection',
      name: 'NotAnError',
      code: 'none',
    })
  })
})

describe('reportError', () => {
  it('does nothing without a sink: tests, the emulators and local work report nothing', () => {
    expect(() => reportError('uncaught', new Error('boom'))).not.toThrow()
  })

  it('hands the report to the sink, and a sink that fails never breaks the app', () => {
    const sink = vi.fn<(report: ErrorReport) => void>()
    setReportSink(sink)
    reportError('uncaught', new RangeError('boom'))
    expect(sink).toHaveBeenCalledWith({ kind: 'uncaught', name: 'RangeError', code: 'none' })

    setReportSink(() => {
      throw new Error('the sink is down')
    })
    expect(() => reportError('uncaught', new Error('boom'))).not.toThrow()
  })
})

describe('reportFirestoreError', () => {
  it('reports only the errors that mean a problem in production: rules and quota', () => {
    const sink = vi.fn<(report: ErrorReport) => void>()
    setReportSink(sink)
    reportFirestoreError(firestoreError('permission-denied', 'a'))
    reportFirestoreError(firestoreError('resource-exhausted', 'b'))
    reportFirestoreError(firestoreError('unavailable', 'offline'))
    reportFirestoreError(new Error('a plain error'))
    expect(sink.mock.calls.map(([report]) => report.code)).toEqual([
      'permission-denied',
      'resource-exhausted',
    ])
  })
})

describe('watchUncaughtErrors', () => {
  it('reports uncaught errors and unhandled rejections of the page, and stops when asked', () => {
    const sink = vi.fn<(report: ErrorReport) => void>()
    setReportSink(sink)
    // A stand-in for the window, so the test runner does not see these errors as its own
    const page = new EventTarget()
    const stop = watchUncaughtErrors(page)

    page.dispatchEvent(new ErrorEvent('error', { error: new TypeError('x') }))
    const rejection = new Event('unhandledrejection') as Event & { reason?: unknown }
    rejection.reason = new SyntaxError('y')
    page.dispatchEvent(rejection)
    expect(sink.mock.calls.map(([report]) => [report.kind, report.name])).toEqual([
      ['uncaught', 'TypeError'],
      ['rejection', 'SyntaxError'],
    ])

    stop()
    page.dispatchEvent(new ErrorEvent('error', { error: new TypeError('z') }))
    expect(sink).toHaveBeenCalledTimes(2)
  })
})
