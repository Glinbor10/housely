import { initializeApp, type FirebaseApp } from 'firebase/app'
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
import { readFirebaseConfig, shouldUseEmulators } from './config'

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

const createFirebase = () => {
  const app = initializeApp(readFirebaseConfig(import.meta.env))
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
