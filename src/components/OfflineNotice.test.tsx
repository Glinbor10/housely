// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OfflineNotice } from './OfflineNotice'

describe('OfflineNotice', () => {
  it('says that what the person does is kept when there is no connection', () => {
    render(<OfflineNotice offline />)
    expect(screen.getByRole('status').textContent).toMatch(/no connection/i)
  })

  it('shows nothing when there is a connection', () => {
    render(<OfflineNotice offline={false} />)
    expect(screen.queryByRole('status')).toBeNull()
  })
})
