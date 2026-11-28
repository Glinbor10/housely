import { describe, expect, it } from 'vitest'
import { assertCredentials, assertRestoreTarget, parseCommand, UsageError } from './cli.mjs'

const env = { BACKUP_PASSPHRASE: 'a long passphrase for the tests' }

describe('parseCommand: backup', () => {
  it('needs the project to be named, it never guesses one', () => {
    expect(() => parseCommand(['backup'], env)).toThrow(UsageError)
    expect(() => parseCommand(['backup'], env)).toThrow(/--project/)
  })

  it('takes the project, the folder and the limit', () => {
    expect(
      parseCommand(
        ['backup', '--project', 'housely-prod', '--out', 'copies', '--max-documents', '500'],
        env,
      ),
    ).toMatchObject({
      command: 'backup',
      project: 'housely-prod',
      out: 'copies',
      maxDocuments: 500,
    })
  })

  it('puts the copies in a folder that git ignores, unless it is told otherwise', () => {
    expect(parseCommand(['backup', '--project', 'housely-prod'], env).out).toBe('backups')
  })

  it.each(['Housely Prod', 'x', 'housely_prod', '../housely', 'HOUSELY-PROD'])(
    'refuses %s as the name of a project',
    (project) => {
      expect(() => parseCommand(['backup', '--project', project], env)).toThrow(/project/i)
    },
  )

  it.each(['0', '-5', 'many', '1.5'])('refuses %s as the limit of documents', (value) => {
    expect(() =>
      parseCommand(['backup', '--project', 'housely-prod', '--max-documents', value], env),
    ).toThrow(/max-documents/)
  })

  it('takes the passphrase from the environment only, so it is not left in the history of the shell', () => {
    expect(() => parseCommand(['backup', '--project', 'housely-prod'], {})).toThrow(
      /BACKUP_PASSPHRASE/,
    )
    expect(() =>
      parseCommand(['backup', '--project', 'housely-prod', '--passphrase', 'secret-secret-1'], env),
    ).toThrow(UsageError)
  })

  it('refuses a short passphrase before it reads anything from the database', () => {
    expect(() =>
      parseCommand(['backup', '--project', 'housely-prod'], { BACKUP_PASSPHRASE: 'short' }),
    ).toThrow(/at least 12/)
  })
})

describe('parseCommand: verify and restore', () => {
  it('needs the file', () => {
    expect(() => parseCommand(['verify'], env)).toThrow(/file/i)
    expect(parseCommand(['verify', 'a.hsbk'], env)).toMatchObject({
      command: 'verify',
      file: 'a.hsbk',
    })
  })

  it('by default only shows what it would do', () => {
    const options = parseCommand(['restore', 'a.hsbk', '--project', 'housely-ci'], env)
    expect(options).toMatchObject({ command: 'restore', apply: false, overwrite: false })
  })

  it('does not write unless the project is typed again, as a second key', () => {
    expect(() =>
      parseCommand(['restore', 'a.hsbk', '--project', 'housely-ci', '--apply'], env),
    ).toThrow(/--confirm/)
    expect(() =>
      parseCommand(
        ['restore', 'a.hsbk', '--project', 'housely-ci', '--apply', '--confirm', 'housely-prod'],
        env,
      ),
    ).toThrow(/--confirm/)
    expect(
      parseCommand(
        ['restore', 'a.hsbk', '--project', 'housely-ci', '--apply', '--confirm', 'housely-ci'],
        env,
      ),
    ).toMatchObject({ apply: true })
  })

  it('refuses an unknown command, and says which ones there are', () => {
    expect(() => parseCommand(['delete'], env)).toThrow(/backup.*verify.*restore/s)
    expect(() => parseCommand([], env)).toThrow(UsageError)
  })
})

describe('assertRestoreTarget', () => {
  it('refuses to put the copy of a project into another one, which is how data ends in the wrong place', () => {
    expect(() =>
      assertRestoreTarget(
        { projectId: 'housely-prod' },
        { project: 'housely-ci', allowOtherProject: false },
      ),
    ).toThrow(/housely-prod.*housely-ci/s)
  })

  it('lets it be done when it is asked for on purpose', () => {
    expect(() =>
      assertRestoreTarget(
        { projectId: 'housely-prod' },
        { project: 'housely-ci', allowOtherProject: true },
      ),
    ).not.toThrow()
    expect(() =>
      assertRestoreTarget(
        { projectId: 'housely-ci' },
        { project: 'housely-ci', allowOtherProject: false },
      ),
    ).not.toThrow()
  })
})

describe('assertCredentials', () => {
  it('asks for a key, or for the emulator, before trying to connect', () => {
    expect(() => assertCredentials({})).toThrow(/GOOGLE_APPLICATION_CREDENTIALS/)
    expect(() => assertCredentials({ GOOGLE_APPLICATION_CREDENTIALS: 'key.json' })).not.toThrow()
    expect(() => assertCredentials({ FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' })).not.toThrow()
  })
})
