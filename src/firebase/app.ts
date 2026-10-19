import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { readFirebaseConfig, shouldUseEmulators } from './config'

const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099'
const FIRESTORE_EMULATOR_HOST = '127.0.0.1'
const FIRESTORE_EMULATOR_PORT = 8080

const createFirebase = () => {
  const app = initializeApp(readFirebaseConfig(import.meta.env))
  const auth = getAuth(app)
  const db = getFirestore(app)
  if (shouldUseEmulators(import.meta.env)) {
    connectAuthEmulator(auth, AUTH_EMULATOR_URL, { disableWarnings: true })
    connectFirestoreEmulator(db, FIRESTORE_EMULATOR_HOST, FIRESTORE_EMULATOR_PORT)
  }
  return { app, auth, db }
}

let instance: ReturnType<typeof createFirebase> | undefined

// Created on first use so importing this module never fails in tests or without configuration.
export const getFirebase = () => (instance ??= createFirebase())
