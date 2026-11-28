interface LogOutSteps {
  signOut: () => Promise<void>
  forgetFlats: () => void
  // Starts the app again, which signs in with a new anonymous identity
  restart: () => void
}

// Signing out comes first: if it fails nothing is forgotten, so the person can try again.
export const logOut = async ({ signOut, forgetFlats, restart }: LogOutSteps): Promise<void> => {
  await signOut()
  forgetFlats()
  restart()
}
