import { describe, expect, it } from 'vitest'
import { validatePullRequest } from './pr-metadata.mjs'

const valid = {
  title: 'feat: add the create flat form',
  body: 'Closes #21',
  author: 'Glinbor10',
}

describe('validatePullRequest', () => {
  it('accepts a conventional title with a linked issue', () => {
    expect(validatePullRequest(valid)).toEqual([])
  })

  it.each(['feat', 'fix', 'docs', 'refactor', 'chore', 'ci', 'test', 'build', 'perf', 'revert'])(
    'accepts the %s type',
    (type) => {
      expect(validatePullRequest({ ...valid, title: `${type}: something` })).toEqual([])
    },
  )

  it('accepts a scope and a breaking change marker', () => {
    expect(validatePullRequest({ ...valid, title: 'feat(flat)!: change the model' })).toEqual([])
  })

  it.each(['Add a feature', 'feat add feature', 'feature: add it', 'feat:', 'feat: '])(
    'rejects the title "%s"',
    (title) => {
      const errors = validatePullRequest({ ...valid, title })
      expect(errors).toHaveLength(1)
      expect(errors[0]).toMatch(/conventional/i)
    },
  )

  it.each(['Closes #1', 'closes #12', 'Fixes #3', 'fixed #4', 'Resolves #5', 'resolved #6'])(
    'accepts the closing keyword "%s"',
    (body) => {
      expect(validatePullRequest({ ...valid, body })).toEqual([])
    },
  )

  it.each([null, '', 'No issue here', 'Related to #12', 'closes 12'])(
    'rejects a body without a closing reference: %s',
    (body) => {
      const errors = validatePullRequest({ ...valid, body })
      expect(errors).toHaveLength(1)
      expect(errors[0]).toMatch(/issue/i)
    },
  )

  it('does not require a linked issue for Dependabot', () => {
    expect(
      validatePullRequest({
        title: 'build(deps): bump foo',
        body: null,
        author: 'dependabot[bot]',
      }),
    ).toEqual([])
  })

  it('still requires a conventional title for Dependabot', () => {
    expect(
      validatePullRequest({ title: 'Bump foo', body: null, author: 'dependabot[bot]' }),
    ).toHaveLength(1)
  })

  it('reports both problems at once', () => {
    expect(validatePullRequest({ title: 'Bad', body: '', author: 'Glinbor10' })).toHaveLength(2)
  })
})
