import { describe, expect, it } from 'vitest'
import {
  readAppCheckSiteKey,
  readFirebaseConfig,
  shouldUseAppCheck,
  shouldUseEmulators,
} from './config'

const validEnv = {
  VITE_FIREBASE_API_KEY: 'key',
  VITE_FIREBASE_AUTH_DOMAIN: 'housely-ci.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'housely-ci',
  VITE_FIREBASE_APP_ID: '1:123:web:abc',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '123',
}

describe('readFirebaseConfig', () => {
  it('maps the environment variables to the Firebase web config', () => {
    expect(readFirebaseConfig(validEnv)).toEqual({
      apiKey: 'key',
      authDomain: 'housely-ci.firebaseapp.com',
      projectId: 'housely-ci',
      appId: '1:123:web:abc',
      messagingSenderId: '123',
    })
  })

  it('fails listing every missing variable', () => {
    expect(() => readFirebaseConfig({ VITE_FIREBASE_API_KEY: 'key' })).toThrowError(
      /VITE_FIREBASE_AUTH_DOMAIN.*VITE_FIREBASE_PROJECT_ID.*VITE_FIREBASE_APP_ID.*VITE_FIREBASE_MESSAGING_SENDER_ID/,
    )
  })

  it('treats empty values as missing', () => {
    expect(() => readFirebaseConfig({ ...validEnv, VITE_FIREBASE_PROJECT_ID: '' })).toThrowError(
      /VITE_FIREBASE_PROJECT_ID/,
    )
  })
})

describe('shouldUseEmulators', () => {
  it('is enabled only when the variable is the string true', () => {
    expect(shouldUseEmulators({ VITE_USE_EMULATORS: 'true' })).toBe(true)
  })

  it.each([undefined, '', 'false', 'TRUE', '1'])('is disabled for %s', (value) => {
    expect(shouldUseEmulators({ VITE_USE_EMULATORS: value })).toBe(false)
  })
})

describe('App Check', () => {
  it('reads the reCAPTCHA site key of the environment', () => {
    expect(readAppCheckSiteKey({ VITE_APPCHECK_SITE_KEY: ' site-key ' })).toBe('site-key')
  })

  it.each([undefined, '', '   '])('has no key for %j', (value) => {
    expect(readAppCheckSiteKey({ VITE_APPCHECK_SITE_KEY: value })).toBeUndefined()
  })

  it('is used when the environment has a key', () => {
    expect(shouldUseAppCheck({ VITE_APPCHECK_SITE_KEY: 'site-key' })).toBe(true)
  })

  it('is left off without a key, so local work and tests need no setup', () => {
    expect(shouldUseAppCheck({})).toBe(false)
  })

  it('is never used with the emulators, which do not check it', () => {
    expect(
      shouldUseAppCheck({ VITE_APPCHECK_SITE_KEY: 'site-key', VITE_USE_EMULATORS: 'true' }),
    ).toBe(false)
  })
})
