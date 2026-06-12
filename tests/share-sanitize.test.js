import { describe, it, expect } from 'vitest'
import { sanitize } from '../server/share.js'

// Share URLs (/r/:title/:score/:status) feed user-controlled params into OG
// HTML. sanitize() is the only barrier before escHtml — pin its behavior.
describe('share sanitize()', () => {
  it('strips HTML-dangerous characters from title and status', () => {
    const { title, status } = sanitize('<script>alert("x")</script>', 50, `"medium"&'`)
    expect(title).toBe('scriptalert(x)/script')
    expect(title).not.toMatch(/[<>"'&]/)
    expect(status).toBe('medium')
  })

  it('clamps score to 0-100 and coerces non-numeric to 0', () => {
    expect(sanitize('plumber', 999, 'raw').score).toBe(100)
    expect(sanitize('plumber', -5, 'raw').score).toBe(0)
    expect(sanitize('plumber', 'DROP TABLE', 'raw').score).toBe(0)
    expect(sanitize('plumber', '42', 'raw').score).toBe(42)
  })

  it('truncates oversized inputs (title 100, status 30)', () => {
    const long = 'x'.repeat(500)
    const out = sanitize(long, 50, long)
    expect(out.title.length).toBe(100)
    expect(out.status.length).toBe(30)
  })

  it('handles null/undefined inputs without throwing', () => {
    const out = sanitize(null, undefined, undefined)
    expect(out.title).toBe('')
    expect(out.score).toBe(0)
    expect(out.status).toBe('')
  })
})
