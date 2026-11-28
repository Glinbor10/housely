// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MembersList } from './MembersList'

const members = [
  {
    id: 'm1',
    name: 'Ana',
    claimed: true,
    color: '#1976d2',
    isCreator: false,
    uid: 'u1',
    hasGoogle: true,
  },
  {
    id: 'm2',
    name: 'Ben',
    claimed: true,
    color: '#388e3c',
    isCreator: true,
    uid: 'u2',
    hasGoogle: true,
  },
  { id: 'm3', name: 'Carl', claimed: false, color: '#f57c00', isCreator: false, hasGoogle: false },
  {
    id: 'm4',
    name: 'Dana',
    claimed: true,
    color: '#7b1fa2',
    isCreator: false,
    uid: 'u4',
    hasGoogle: false,
  },
]

// Opens the menu of a person and presses one of its options
const choose = async (person: string, option: RegExp) => {
  await userEvent.click(screen.getByRole('button', { name: `Options for ${person}` }))
  await userEvent.click(await screen.findByRole('menuitem', { name: option }))
}

const renderList = (props: Partial<Parameters<typeof MembersList>[0]> = {}) => {
  const onRelease = vi.fn()
  const onChangeColor = vi.fn()
  const onHandOver = vi.fn()
  render(
    <MembersList
      members={members}
      currentMemberId="m1"
      canManage
      busy={false}
      error={null}
      colorBusy={false}
      onRelease={onRelease}
      handOverBusy={false}
      handOverError={null}
      onHandOver={onHandOver}
      onChangeColor={onChangeColor}
      {...props}
    />,
  )
  return { onRelease, onChangeColor, onHandOver }
}

describe('MembersList colors', () => {
  it('shows each person with their own color', () => {
    renderList()
    const avatars = screen
      .getAllByTestId('avatar')
      .map((node) => getComputedStyle(node).backgroundColor)
    expect(avatars).toEqual([
      'rgb(25, 118, 210)',
      'rgb(56, 142, 60)',
      'rgb(245, 124, 0)',
      'rgb(123, 31, 162)',
    ])
  })

  it('does not show the colors to pick until the pencil of the person is pressed', () => {
    renderList()
    expect(screen.queryByRole('group', { name: /your color/i })).toBeNull()
  })

  it('has a pencil only on the avatar of the current person', () => {
    renderList()
    expect(screen.getAllByRole('button', { name: /change your color/i })).toHaveLength(1)
  })

  it('lets a person choose their own color from the pencil, and closes the choice afterwards', async () => {
    const { onChangeColor } = renderList()
    await userEvent.click(screen.getByRole('button', { name: /change your color/i }))
    expect(screen.getAllByRole('group', { name: /your color/i })).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Pink' }))
    expect(onChangeColor).toHaveBeenCalledWith('#c2185b')
    expect(screen.queryByRole('group', { name: /your color/i })).toBeNull()
  })

  it('only offers the colors that the others do not have', async () => {
    renderList()
    await userEvent.click(screen.getByRole('button', { name: /change your color/i }))
    expect(screen.queryByRole('button', { name: /green/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /orange/i })).toBeNull()
    // Their own color is the one that is chosen
    expect(screen.getByRole('button', { name: 'Blue' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('can close the choice without changing anything', async () => {
    const { onChangeColor } = renderList()
    const pencil = screen.getByRole('button', { name: /change your color/i })
    await userEvent.click(pencil)
    await userEvent.click(pencil)
    expect(screen.queryByRole('group', { name: /your color/i })).toBeNull()
    expect(onChangeColor).not.toHaveBeenCalled()
  })
})

describe('MembersList badges', () => {
  it('marks who created the home, and only them', () => {
    renderList()
    expect(screen.getAllByText(/created the home/i)).toHaveLength(1)
    const ben = screen.getByText('Ben').closest('li') as HTMLElement
    expect(ben.textContent).toMatch(/created the home/i)
  })

  it('marks the current person with (you), also when they are the creator', () => {
    renderList({ currentMemberId: 'm2' })
    expect(screen.getByText('Ben (you)')).toBeTruthy()
    expect(screen.getAllByText(/created the home/i)).toHaveLength(1)
  })
})

describe('MembersList', () => {
  it('shows every person and whether they have joined', () => {
    renderList()
    expect(screen.getByText('Ana (you)')).toBeTruthy()
    expect(screen.getByText('Ben')).toBeTruthy()
    expect(screen.getByText(/waiting for carl to join/i)).toBeTruthy()
  })

  it('gives a menu of options to the owner for the people who have joined, but not for themselves or for people who have not joined', () => {
    renderList()
    expect(screen.getAllByRole('button', { name: /^options for/i })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Options for Ana' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Options for Carl' })).toBeNull()
  })

  it('makes the button of the options as big as a fingertip needs, like the rest of the app', () => {
    renderList()
    for (const button of screen.getAllByRole('button', { name: /^options for/i })) {
      const style = getComputedStyle(button)
      expect(style.width).toBe('44px')
      expect(style.height).toBe('44px')
    }
  })

  it('offers nothing to manage to people who are not the owner, only the pencil of their own color', () => {
    renderList({ canManage: false })
    expect(screen.queryByRole('button', { name: /^options for/i })).toBeNull()
    expect(screen.getAllByRole('button', { name: /change your color/i })).toHaveLength(1)
  })

  it('asks for confirmation and explains what happens before releasing', async () => {
    const { onRelease } = renderList()
    await choose('Ben', /release ben/i)
    expect(screen.getByText(/lose access/i)).toBeTruthy()
    expect(onRelease).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /yes, release/i }))
    expect(onRelease).toHaveBeenCalledWith('m2')
  })

  it('can cancel the confirmation', async () => {
    const { onRelease } = renderList()
    await choose('Ben', /release ben/i)
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onRelease).not.toHaveBeenCalled()
    expect(screen.queryByText(/lose access/i)).toBeNull()
  })

  it('shows a failed release', () => {
    renderList({ error: 'Could not release' })
    expect(screen.getByText('Could not release')).toBeTruthy()
  })
})

describe('MembersList making somebody the owner', () => {
  it('explains what it means and hands the flat over to the person who has Google', async () => {
    const { onHandOver } = renderList()
    await choose('Ben', /make owner of the home/i)
    expect(await screen.findByText(/only ben could give it back/i)).toBeTruthy()
    expect(onHandOver).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /yes, make owner/i }))
    expect(onHandOver).toHaveBeenCalledWith('u2')
  })

  it('does not hand it over to somebody without Google, and says what they have to do', async () => {
    const { onHandOver } = renderList()
    await choose('Dana', /make owner of the home/i)
    expect(await screen.findByText(/must link a google account in settings/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /yes, make owner/i })).toBeNull()
    expect(onHandOver).not.toHaveBeenCalled()
  })

  it('shows the error when the hand over fails', async () => {
    renderList({ handOverError: 'Could not hand over' })
    await choose('Ben', /make owner of the home/i)
    expect(await screen.findByText('Could not hand over')).toBeTruthy()
  })
})

describe('MembersList Google mark', () => {
  it('tells everybody, owner or not, who has a Google account and who has not, only for people who have joined', () => {
    renderList({ canManage: false })
    // Ana, Ben has Google; Dana does not; Carl has not joined yet
    expect(screen.getAllByText('Google account')).toHaveLength(2)
    expect(screen.getAllByText('No Google')).toHaveLength(1)
    const dana = screen.getByText('Dana').closest('li') as HTMLElement
    expect(dana.textContent).toMatch(/no google/i)
    const carl = screen.getByText('Carl').closest('li') as HTMLElement
    expect(carl.textContent).not.toMatch(/google/i)
  })
})
