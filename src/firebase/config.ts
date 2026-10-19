export interface FirebaseWebConfig {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
  messagingSenderId: string
}

const REQUIRED_VARIABLES = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  appId: 'VITE_FIREBASE_APP_ID',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
} as const

// The web config is public by design (security lives in Firestore rules), but it differs per
// environment, so it is injected at build time instead of being committed.
export const readFirebaseConfig = (env: Record<string, string | undefined>): FirebaseWebConfig => {
  const missing = Object.values(REQUIRED_VARIABLES).filter((name) => !env[name])
  if (missing.length > 0) {
    throw new Error(`Missing Firebase environment variables: ${missing.join(', ')}`)
  }
  return {
    apiKey: env[REQUIRED_VARIABLES.apiKey]!,
    authDomain: env[REQUIRED_VARIABLES.authDomain]!,
    projectId: env[REQUIRED_VARIABLES.projectId]!,
    appId: env[REQUIRED_VARIABLES.appId]!,
    messagingSenderId: env[REQUIRED_VARIABLES.messagingSenderId]!,
  }
}
