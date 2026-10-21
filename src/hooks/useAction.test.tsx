// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useAction } from './useAction'

describe('useAction', () => {
  it('starts idle without an error', () => {
    const { result } = renderHook(() => useAction())
    expect(result.current.busy).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('is busy while the action runs and idle afterwards', async () => {
    const { result } = renderHook(() => useAction())
    let finish: () => void = () => {}
    let running: Promise<boolean> = Promise.resolve(true)
    act(() => {
      running = result.current.run(() => new Promise<void>((resolve) => (finish = resolve)))
    })
    expect(result.current.busy).toBe(true)
    await act(async () => {
      finish()
      await running
    })
    expect(result.current.busy).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('tells whether the action worked, so the caller can celebrate only a real success', async () => {
    const { result } = renderHook(() => useAction())
    let worked: boolean | undefined
    let failed: boolean | undefined
    await act(async () => {
      worked = await result.current.run(() => Promise.resolve())
      failed = await result.current.run(() => Promise.reject(new Error('denied')))
    })
    expect(worked).toBe(true)
    expect(failed).toBe(false)
  })

  it('keeps the message of a failed action', async () => {
    const { result } = renderHook(() => useAction())
    await act(async () => {
      await result.current.run(() => Promise.reject(new Error('denied')))
    })
    expect(result.current.busy).toBe(false)
    expect(result.current.error).toBe('denied')
  })

  it('uses a generic message for failures that are not errors', async () => {
    const { result } = renderHook(() => useAction())
    await act(async () => {
      await result.current.run(() => Promise.reject('boom'))
    })
    expect(result.current.error).toMatch(/something went wrong/i)
  })

  it('clears the previous error when the next action starts and succeeds', async () => {
    const { result } = renderHook(() => useAction())
    await act(async () => {
      await result.current.run(() => Promise.reject(new Error('denied')))
    })
    await act(async () => {
      await result.current.run(() => Promise.resolve())
    })
    expect(result.current.error).toBeNull()
  })
})
