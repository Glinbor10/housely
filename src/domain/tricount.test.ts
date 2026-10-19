import { describe, expect, it } from 'vitest'
import { parseTricountUrl } from './tricount'

describe('parseTricountUrl', () => {
  it.each([
    'https://tricount.com/tABC123',
    'https://tricount.com/es/tABC123',
    'https://www.tricount.com/tABC123',
    'https://app.tricount.com/x?y=1#z',
  ])('accepts %s', (input) => {
    expect(parseTricountUrl(input)).toEqual({ ok: true, url: input })
  })

  it('trims surrounding spaces', () => {
    expect(parseTricountUrl('  https://tricount.com/abc  ')).toEqual({
      ok: true,
      url: 'https://tricount.com/abc',
    })
  })

  it('treats an empty value as clearing the link', () => {
    expect(parseTricountUrl('')).toEqual({ ok: true, url: null })
    expect(parseTricountUrl('   ')).toEqual({ ok: true, url: null })
  })

  it.each([
    ['http://tricount.com/abc', 'not-https'],
    ['tricount.com/abc', 'not-https'],
    ['https://evil.com/abc', 'not-tricount'],
    ['https://tricount.com.evil.com/abc', 'not-tricount'],
    ['https://eviltricount.com/abc', 'not-tricount'],
    ['https://user@tricount.com/abc', 'not-tricount'],
    ['https://tricount.com:8080/abc', 'not-tricount'],
    ['javascript:alert(1)', 'not-https'],
    ['not a url', 'not-https'],
  ])('rejects %s', (input, reason) => {
    expect(parseTricountUrl(input)).toEqual({ ok: false, reason })
  })

  it('rejects links longer than 300 characters', () => {
    expect(parseTricountUrl(`https://tricount.com/${'a'.repeat(300)}`)).toEqual({
      ok: false,
      reason: 'too-long',
    })
  })
})
