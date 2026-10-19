const CONVENTIONAL_TITLE =
  /^(feat|fix|docs|refactor|chore|ci|test|build|perf|revert)(\([^)]+\))?!?: \S.*$/
const CLOSING_REFERENCE = /\b(close[sd]?|fix(e[sd])?|resolve[sd]?)\s+#\d+/i
const BOT_AUTHORS = ['dependabot[bot]']

// Returns the list of problems of a pull request; empty when it is valid.
export const validatePullRequest = ({ title, body, author }) => {
  const errors = []
  if (!CONVENTIONAL_TITLE.test(title ?? '')) {
    errors.push(
      'The title must follow conventional commits, for example "feat: add the create flat form" ' +
        '(types: feat, fix, docs, refactor, chore, ci, test, build, perf, revert).',
    )
  }
  if (!BOT_AUTHORS.includes(author) && !CLOSING_REFERENCE.test(body ?? '')) {
    errors.push(
      'The description must link an issue with a closing keyword, for example "Closes #21".',
    )
  }
  return errors
}
