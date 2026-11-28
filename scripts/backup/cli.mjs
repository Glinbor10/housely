#!/usr/bin/env node
// Own copy of the data of Firestore, for the Spark plan, which has no backups of its own.
//
//   node scripts/backup/cli.mjs backup  --project housely-prod
//   node scripts/backup/cli.mjs verify  backups/housely-prod-20261113T123045Z.hsbk
//   node scripts/backup/cli.mjs restore backups/housely-prod-20261113T123045Z.hsbk --project housely-prod
//
// Read docs/maintenance/backup-and-restore.adoc before using it.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { Firestore } from '@google-cloud/firestore'
import {
  backupFileName,
  buildBackup,
  buildManifest,
  parseBackup,
  serializeBackup,
} from './backupFile.mjs'
import { decryptBuffer, encryptBuffer, MIN_PASSPHRASE_LENGTH } from './crypto.mjs'
import { DEFAULT_MAX_DOCUMENTS, dumpDatabase } from './dump.mjs'
import { restoreDocuments } from './restore.mjs'

export class UsageError extends Error {
  name = 'UsageError'
}

const COMMANDS = ['backup', 'verify', 'restore']
// The rules of Google Cloud for the id of a project: 6 to 30 characters, lowercase, digits and hyphens
const PROJECT_ID = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/

const OPTIONS = {
  project: { type: 'string' },
  out: { type: 'string' },
  'max-documents': { type: 'string' },
  apply: { type: 'boolean' },
  overwrite: { type: 'boolean' },
  confirm: { type: 'string' },
  'allow-other-project': { type: 'boolean' },
}

export const parseCommand = (argv, env) => {
  let parsed
  try {
    parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true })
  } catch (error) {
    throw new UsageError(error.message)
  }
  const [command, file] = parsed.positionals
  const values = parsed.values
  if (!COMMANDS.includes(command)) {
    throw new UsageError(`Use one of these commands: ${COMMANDS.join(', ')}`)
  }

  // The passphrase never goes in the command line: it would stay in the history of the shell
  const passphrase = env.BACKUP_PASSPHRASE
  if (!passphrase) {
    throw new UsageError('Set the passphrase in the environment variable BACKUP_PASSPHRASE')
  }
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new UsageError(`The passphrase must have at least ${MIN_PASSPHRASE_LENGTH} characters`)
  }

  if (command === 'verify') {
    if (!file) throw new UsageError('Give the backup file to verify')
    return { command, file, passphrase }
  }

  if (!values.project) throw new UsageError('Name the project with --project <id>')
  if (!PROJECT_ID.test(values.project)) {
    throw new UsageError(`"${values.project}" is not a valid project id`)
  }

  if (command === 'backup') {
    const rawLimit = values['max-documents']
    if (rawLimit !== undefined && !/^[1-9][0-9]*$/.test(rawLimit)) {
      throw new UsageError('--max-documents must be a whole number above zero')
    }
    return {
      command,
      project: values.project,
      out: values.out ?? 'backups',
      maxDocuments: rawLimit === undefined ? DEFAULT_MAX_DOCUMENTS : Number(rawLimit),
      passphrase,
    }
  }

  if (!file) throw new UsageError('Give the backup file to restore')
  const apply = values.apply === true
  // Writing needs the project to be typed a second time: a command pasted by mistake does not write
  if (apply && values.confirm !== values.project) {
    throw new UsageError(`To write, repeat the project: --apply --confirm ${values.project}`)
  }
  return {
    command,
    file,
    project: values.project,
    apply,
    overwrite: values.overwrite === true,
    allowOtherProject: values['allow-other-project'] === true,
    passphrase,
  }
}

export const assertRestoreTarget = (backup, { project, allowOtherProject }) => {
  if (backup.projectId !== project && !allowOtherProject) {
    throw new UsageError(
      `This copy comes from ${backup.projectId} and you are restoring it into ${project}. ` +
        'If that is on purpose, add --allow-other-project.',
    )
  }
}

export const assertCredentials = (env) => {
  if (!env.GOOGLE_APPLICATION_CREDENTIALS && !env.FIRESTORE_EMULATOR_HOST) {
    throw new UsageError(
      'Set GOOGLE_APPLICATION_CREDENTIALS to the path of the key file of the service account ' +
        '(see docs/maintenance/backup-and-restore.adoc)',
    )
  }
}

const progress = (label) => {
  let last = 0
  return (count) => {
    if (count - last >= 100) {
      last = count
      process.stderr.write(`${label}: ${count}\r`)
    }
  }
}

const runBackup = async (options, env) => {
  assertCredentials(env)
  const db = new Firestore({ projectId: options.project })
  const createdAt = new Date()
  const { documents, documentCount, estimatedReads } = await dumpDatabase(db, {
    maxDocuments: options.maxDocuments,
    onProgress: progress('Read'),
  })
  const backup = buildBackup({ projectId: options.project, documents, createdAt })
  const encrypted = encryptBuffer(serializeBackup(backup), options.passphrase)

  mkdirSync(options.out, { recursive: true })
  const file = join(options.out, backupFileName(options.project, createdAt))
  // Only the owner can read it, where the system allows it
  writeFileSync(file, encrypted, { mode: 0o600 })
  const manifest = buildManifest({ projectId: options.project, createdAt, documents, encrypted })
  writeFileSync(`${file}.manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`)

  console.log(`Copy of ${options.project}: ${documentCount} documents`)
  console.log(`Reads spent: about ${estimatedReads} (the free quota is 50,000 a day)`)
  console.log(`File: ${file}`)
  console.log('Keep it somewhere that is not this computer only, and keep the passphrase apart.')
}

const readBackup = (file, passphrase) => {
  const encrypted = readFileSync(file)
  return { encrypted, backup: parseBackup(decryptBuffer(encrypted, passphrase)) }
}

const runVerify = (options) => {
  const { encrypted, backup } = readBackup(options.file, options.passphrase)
  const manifestFile = `${options.file}.manifest.json`
  if (existsSync(manifestFile)) {
    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
    const sha256 = createHash('sha256').update(encrypted).digest('hex')
    if (manifest.sha256 !== sha256) {
      throw new Error('The file does not match its manifest: it was changed or damaged')
    }
  } else {
    console.log('There is no manifest next to the file: the fingerprint was not checked')
  }
  console.log(`The copy is good: ${backup.documentCount} documents of ${backup.projectId}`)
  console.log(`Made on ${backup.createdAt}`)
}

const runRestore = async (options, env) => {
  assertCredentials(env)
  const { backup } = readBackup(options.file, options.passphrase)
  assertRestoreTarget(backup, options)
  const db = new Firestore({ projectId: options.project })
  const summary = await restoreDocuments(db, backup.documents, {
    apply: options.apply,
    overwrite: options.overwrite,
    onProgress: progress('Written'),
  })
  console.log(
    `${options.apply ? 'Written' : 'It would write'}: ${summary.create} new, ` +
      `${summary.overwrite} replaced, ${summary.skip} left as they are`,
  )
  if (!options.apply) {
    console.log(`Nothing was written. To do it: add --apply --confirm ${options.project}`)
  }
}

export const main = async (argv, env) => {
  const options = parseCommand(argv, env)
  if (options.command === 'backup') await runBackup(options, env)
  else if (options.command === 'verify') runVerify(options)
  else await runRestore(options, env)
}

// Only runs when it is started from the command line, not when the tests import it
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2), process.env).catch((error) => {
    // The message only: a stack trace can show paths, and the passphrase never gets here
    console.error(
      error instanceof UsageError ? `${error.message}\n\n${USAGE}` : `Error: ${error.message}`,
    )
    process.exitCode = error instanceof UsageError ? 2 : 1
  })
}

const USAGE = `Usage:
  node scripts/backup/cli.mjs backup  --project <id> [--out <folder>] [--max-documents <n>]
  node scripts/backup/cli.mjs verify  <file>
  node scripts/backup/cli.mjs restore <file> --project <id> [--overwrite] [--apply --confirm <id>]

The passphrase goes in BACKUP_PASSPHRASE and the key of the service account in
GOOGLE_APPLICATION_CREDENTIALS. See docs/maintenance/backup-and-restore.adoc.`
