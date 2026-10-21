import { initializeApp, type FirebaseApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth'
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'
import {
  readAppCheckSiteKey,
  readFirebaseConfig,
  shouldUseAppCheck,
  shouldUseEmulators,
} from './config'

const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099'
const FIRESTORE_EMULATOR_HOST = '127.0.0.1'
const FIRESTORE_EMULATOR_PORT = 8080

// Reads work offline and writes are queued until the connection comes back, in every open tab.
const createFirestore = (app: FirebaseApp): Firestore => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch {
    // Firestore was already initialized for this app (hot reload or a second module instance)
    return getFirestore(app)
  }
}

// Only anonymous sign-in is used, so the popup and redirect machinery is left out: it would load a
// Google script (apis.google.com) that our Content-Security-Policy rightly blocks.
const createAuth = (app: FirebaseApp): Auth => {
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    })
  } catch {
    // Auth was already initialized for this app (hot reload or a second module instance)
    return getAuth(app)
  }
}

// Every request to Firebase carries a token that proves it comes from this app in a real browser, so a
// script that only knows the (public) web config cannot use the project. It must start before Auth and
// Firestore make their first request.
const startAppCheck = (app: FirebaseApp): void => {
  const siteKey = readAppCheckSiteKey(import.meta.env)
  if (!shouldUseAppCheck(import.meta.env) || siteKey === undefined) return
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    })
  } catch {
    // App Check was already initialized for this app (hot reload or a second module instance)
  }
}

const createFirebase = () => {
  const app = initializeApp(readFirebaseConfig(import.meta.env))
  startAppCheck(app)
  const auth = createAuth(app)
  const db = createFirestore(app)
  if (shouldUseEmulators(import.meta.env)) {
    connectAuthEmulator(auth, AUTH_EMULATOR_URL, { disableWarnings: true })
    connectFirestoreEmulator(db, FIRESTORE_EMULATOR_HOST, FIRESTORE_EMULATOR_PORT)
  }
  return { app, auth, db }
}

let instance: ReturnType<typeof createFirebase> | undefined

// Created on first use so importing this module never fails in tests or without configuration.
export const getFirebase = () => (instance ??= createFirebase())
