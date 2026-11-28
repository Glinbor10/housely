import {
  GoogleAuthProvider,
  browserPopupRedirectResolver,
  linkWithPopup,
  onIdTokenChanged,
  signInWithCredential,
  signInWithPopup,
  type Auth,
  type AuthCredential,
  type User,
} from 'firebase/auth'
import {
  continueWithGoogle,
  type AuthUserInfo,
  type GoogleAccessOptions,
  type GoogleOutcome,
} from './googleAccess'

// The Firebase calls that open Google, replaceable so tests can skip the popup and keep the rest.
export interface GoogleOps {
  linkWithPopup: (user: User) => Promise<User>
  signInWithPopup: (auth: Auth) => Promise<User>
  credentialFromError: (error: unknown) => AuthCredential | null
  signInWithCredential: (auth: Auth, credential: AuthCredential) => Promise<User>
}

// The popup resolver is passed only here: the rest of the app never loads the Google script, which is
// why Auth is created without it (see app.ts).
const popupOps: GoogleOps = {
  linkWithPopup: async (user) =>
    (await linkWithPopup(user, new GoogleAuthProvider(), browserPopupRedirectResolver)).user,
  signInWithPopup: async (auth) =>
    (await signInWithPopup(auth, new GoogleAuthProvider(), browserPopupRedirectResolver)).user,
  credentialFromError: (error) => GoogleAuthProvider.credentialFromError(error as never),
  signInWithCredential: async (auth, credential) =>
    (await signInWithCredential(auth, credential)).user,
}

export const toAuthUserInfo = (user: User | null): AuthUserInfo | null =>
  user === null
    ? null
    : {
        uid: user.uid,
        isAnonymous: user.isAnonymous,
        providerIds: user.providerData.map((provider) => provider.providerId),
        displayName: user.displayName,
        email: user.email,
        photoUrl: user.photoURL,
      }

// onIdTokenChanged rather than onAuthStateChanged: linking an anonymous account to Google keeps the
// same user, so only the token refresh tells that the account changed.
export const subscribeAuthUser = (
  auth: Auth,
  onChange: (user: AuthUserInfo | null) => void,
): (() => void) => onIdTokenChanged(auth, (user) => onChange(toAuthUserInfo(user)))

// Links the anonymous account to Google, or signs in to the Google account that already exists. The
// token is refreshed afterwards: the rules read the identities claim, which only changes on refresh.
export const openGoogle = (
  auth: Auth,
  ops: GoogleOps = popupOps,
  options: GoogleAccessOptions = {},
): Promise<GoogleOutcome> => {
  const refreshed = async (user: User) => {
    await user.getIdToken(true)
    return user
  }
  return continueWithGoogle(
    {
      user: toAuthUserInfo(auth.currentUser),
      link: async () => refreshed(await ops.linkWithPopup(auth.currentUser as User)),
      signIn: async () => refreshed(await ops.signInWithPopup(auth)),
      signInWithCredentialFromError: async (error) => {
        const credential = ops.credentialFromError(error)
        return credential === null
          ? null
          : refreshed(await ops.signInWithCredential(auth, credential))
      },
    },
    options,
  )
}
