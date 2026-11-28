import { describe, expect, it, vi } from 'vitest'
import { logOut } from './logOut'

const setup = (signOut = vi.fn().mockResolvedValue(undefined)) => {
  const calls: string[] = []
  const deps = {
    signOut: () => {
      calls.push('signOut')
      return signOut()
    },
    forgetFlats: () => calls.push('forgetFlats'),
    restart: () => calls.push('restart'),
  }
  return { deps, calls }
}

describe('logOut', () => {
  it('signs out, forgets the flats of the device and then restarts the app', async () => {
    const { deps, calls } = setup()
    await logOut(deps)
    expect(calls).toEqual(['signOut', 'forgetFlats', 'restart'])
  })

  it('keeps the flats and does not restart when signing out fails, so the person can try again', async () => {
    const { deps, calls } = setup(vi.fn().mockRejectedValue(new Error('network')))
    await expect(logOut(deps)).rejects.toThrow('network')
    expect(calls).toEqual(['signOut'])
  })
})
