import { useState } from 'react'

interface ActionState {
  busy: boolean
  error: string | null
}

// Runs an async action (a save, a release...) exposing whether it is in flight and why it failed.
export const useAction = () => {
  const [state, setState] = useState<ActionState>({ busy: false, error: null })

  const run = async (action: () => Promise<void>): Promise<void> => {
    setState({ busy: true, error: null })
    try {
      await action()
      setState({ busy: false, error: null })
    } catch (failure) {
      setState({
        busy: false,
        error: failure instanceof Error ? failure.message : 'Something went wrong. Try again.',
      })
    }
  }

  return { busy: state.busy, error: state.error, run }
}
