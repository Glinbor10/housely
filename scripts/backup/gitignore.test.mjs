import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

// Asks git itself, so the test fails if the rules are wrong and not only if they are missing
const isIgnored = (path) => spawnSync('git', ['check-ignore', '-q', path]).status === 0

describe('what git must never see', () => {
  it.each([
    'backups/housely-prod-20261113T123045Z.hsbk',
    'housely-prod-20261113T123045Z.hsbk',
    'housely-prod-20261113T123045Z.hsbk.manifest.json',
    'service-account.json',
    'housely-prod-service-account.json',
    'housely-backup-key.json',
  ])('ignores %s, which holds personal data or gives access to the database', (path) => {
    expect(isIgnored(path)).toBe(true)
  })

  it('does not ignore the code of the copy', () => {
    for (const path of [
      'scripts/backup/cli.mjs',
      'scripts/backup/dump.mjs',
      'docs/maintenance/backup-and-restore.adoc',
    ]) {
      expect(isIgnored(path)).toBe(false)
    }
  })
})
