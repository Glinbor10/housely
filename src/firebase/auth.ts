import { signInAnonymously, type Auth } from 'firebase/auth'

// Every device gets an anonymous identity once and keeps it: Firebase persists it locally.
export const ensureAnonymousUser = async (auth: Auth): Promise<string> => {
  await auth.authStateReady()
  const user = auth.currentUser ?? (await signInAnonymously(auth)).user
  return user.uid
}
