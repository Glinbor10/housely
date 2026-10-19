import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const config = JSON.parse(readFileSync('firebase.json', 'utf8'))
const rules = config.hosting.headers ?? []

const headersFor = (source) =>
  Object.fromEntries(
    (rules.find((rule) => rule.source === source)?.headers ?? []).map(({ key, value }) => [
      key,
      value,
    ]),
  )

const global = headersFor('**')
const directives = Object.fromEntries(
  (global['Content-Security-Policy'] ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, ...values] = part.split(/\s+/)
      return [name, values]
    }),
)

describe('hosting security headers', () => {
  it('sets the basic hardening headers for every route', () => {
    expect(global['X-Content-Type-Options']).toBe('nosniff')
    expect(global['X-Frame-Options']).toBe('DENY')
    expect(global['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(global['Strict-Transport-Security']).toMatch(/max-age=\d{7,}/)
    expect(global['Permissions-Policy']).toMatch(/camera=\(\)/)
    expect(global['Permissions-Policy']).toMatch(/microphone=\(\)/)
    expect(global['Permissions-Policy']).toMatch(/geolocation=\(\)/)
  })

  it('has a restrictive Content-Security-Policy', () => {
    expect(directives['default-src']).toEqual(["'self'"])
    expect(directives['object-src']).toEqual(["'none'"])
    expect(directives['base-uri']).toEqual(["'self'"])
    expect(directives['frame-ancestors']).toEqual(["'none'"])
    expect(directives['form-action']).toEqual(["'self'"])
  })

  it('never allows inline or eval scripts', () => {
    const scripts = directives['script-src'] ?? []
    expect(scripts).toContain("'self'")
    expect(scripts).not.toContain("'unsafe-inline'")
    expect(scripts).not.toContain("'unsafe-eval'")
  })

  it('lets the Firebase Auth and Firestore web SDK reach Google, and nothing wider', () => {
    const connect = directives['connect-src'] ?? []
    expect(connect).toEqual(
      expect.arrayContaining([
        "'self'",
        'https://firestore.googleapis.com',
        'https://identitytoolkit.googleapis.com',
        'https://securetoken.googleapis.com',
      ]),
    )
    expect(connect).not.toContain('*')
    expect(connect).not.toContain('https:')
  })

  it('caches hashed assets as immutable and never caches the entry point', () => {
    expect(headersFor('/assets/**')['Cache-Control']).toMatch(/immutable/)
    expect(headersFor('/')['Cache-Control']).toMatch(/no-cache/)
    expect(headersFor('/index.html')['Cache-Control']).toMatch(/no-cache/)
  })
})
