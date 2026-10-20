// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { FlatLimitError } from '../firebase/flatRepository'
import { GoogleAccessError } from '../firebase/googleAccess'
import { describeError } from './describeError'
import { setLocale } from './i18n'

afterEach(() => setLocale('en'))

describe('describeError', () => {
  it('says a Google error in the language of the person', () => {
    expect(describeError(new GoogleAccessError('network'))).toMatch(/No connection/)
    setLocale('es')
    expect(describeError(new GoogleAccessError('network'))).toMatch(/Sin conexión/)
  })

  it('fills in the parameters of the error', () => {
    setLocale('es')
    expect(describeError(new FlatLimitError())).toMatch(/hasta 3 pisos/)
  })

  it('keeps the message of an error that is not translated', () => {
    expect(describeError(new Error('permission-denied'))).toBe('permission-denied')
  })

  it('has a friendly fallback when there is nothing to say', () => {
    expect(describeError('boom')).toMatch(/Something went wrong/)
    expect(describeError(new Error(''))).toMatch(/Something went wrong/)
    setLocale('es')
    expect(describeError(null)).toMatch(/Algo ha ido mal/)
  })
})
