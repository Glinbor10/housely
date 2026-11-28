import type { FirebaseApp } from 'firebase/app'
import { getPerformance, trace } from 'firebase/performance'
import { setReportSink, watchUncaughtErrors, type ErrorReport } from '../monitoring/errorReport'

// One custom trace per error: the Firebase console counts them and splits them by these attributes
// (Performance › Custom traces › app_error). It is free on the Spark plan and costs no Firestore quota.
const ERROR_TRACE = 'app_error'

// Performance Monitoring measures, on its own, how long the page takes to load and how long each
// request to Firebase takes, on the phones of real people. On top of that, every error is counted.
export const startMonitoring = (app: FirebaseApp, page: Window): void => {
  try {
    const performance = getPerformance(app)
    setReportSink((report: ErrorReport) => {
      trace(performance, ERROR_TRACE).record(Date.now(), 1, {
        metrics: { count: 1 },
        attributes: { kind: report.kind, name: report.name, code: report.code },
      })
    })
    watchUncaughtErrors(page)
  } catch {
    // A browser without what Performance Monitoring needs still runs the app
  }
}
