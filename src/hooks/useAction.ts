import { useState } from 'react'
import { describeError } from '../i18n/describeError'

interface ActionState {
  busy: boolean
  error: string | null
}

// Runs an async action (a save, a release...) exposing whether it is in flight and why it failed.
export const useAction = () => {
  const [state, setState] = useState<ActionState>({ busy: false, error: null })

  // Resolves to whether the action worked
  const run = async (action: () => Promise<void>): Promise<boolean> => {
    setState({ busy: true, error: null })
    try {
      await action()
      setState({ busy: false, error: null })
      return true
    } catch (failure) {
      setState({
        busy: false,
        error: describeError(failure),
      })
      return false
    }
  }

  return { busy: state.busy, error: state.error, run }
}
