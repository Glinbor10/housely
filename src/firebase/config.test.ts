import { describe, expect, it } from 'vitest'
import { readFirebaseConfig } from './config'

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
