// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

// Proves the component testing setup works (DOM, events and cleanup between tests).
const Counter = () => {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>Clicked {count}</button>
}

describe('component testing setup', () => {
  it('renders and reacts to user events', async () => {
    render(<Counter />)
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button').textContent).toBe('Clicked 1')
  })

  it('starts every test with a clean DOM', () => {
    render(<Counter />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })
})
