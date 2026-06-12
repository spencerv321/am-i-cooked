import { describe, it, expect } from 'vitest'
import { scoreToStatus, scoreToEmoji } from '../server/scoring.js'
import { Analytics } from '../server/analytics/tracker.js'
import { scoreEmoji, scoreColor } from '../server/share.js'

// The score→status boundaries are duplicated across multiple modules and must
// stay aligned (CLAUDE.md "What NOT to Do" #3). This suite turns that doc
// warning into a failing test: it asserts every implementation agrees at and
// around every boundary.

const tracker = new Analytics(null) // null pool — only the pure helpers are used

// Every boundary edge plus extremes
const PROBE_SCORES = [0, 20, 21, 40, 41, 60, 61, 80, 81, 100]

const EXPECTED = {
  0: ['Raw', '🧊'], 20: ['Raw', '🧊'],
  21: ['Medium Rare', '🥩'], 40: ['Medium Rare', '🥩'],
  41: ['Medium', '🍳'], 60: ['Medium', '🍳'],
  61: ['Well Done', '🔥'], 80: ['Well Done', '🔥'],
  81: ['Fully Cooked', '💀'], 100: ['Fully Cooked', '💀'],
}

describe('status boundaries: scoring.js', () => {
  it.each(PROBE_SCORES)('score %i maps to documented status + emoji', (s) => {
    expect(scoreToStatus(s)).toBe(EXPECTED[s][0])
    expect(scoreToEmoji(s)).toBe(EXPECTED[s][1])
  })
})

describe('cross-module alignment at every boundary', () => {
  it.each(PROBE_SCORES)('tracker.js agrees with scoring.js at %i', (s) => {
    expect(tracker._scoreToStatus(s)).toBe(scoreToStatus(s))
    expect(tracker._scoreToEmoji(s)).toBe(scoreToEmoji(s))
  })

  it.each(PROBE_SCORES)('share.js emoji agrees with scoring.js at %i', (s) => {
    expect(scoreEmoji(s)).toBe(scoreToEmoji(s))
  })

  it('share.js colors change exactly at the status boundaries', () => {
    // Colors are distinct per band and must flip at the same edges as status
    expect(scoreColor(20)).not.toBe(scoreColor(21))
    expect(scoreColor(40)).not.toBe(scoreColor(41))
    expect(scoreColor(60)).not.toBe(scoreColor(61))
    expect(scoreColor(80)).not.toBe(scoreColor(81))
    // Within-band stability
    expect(scoreColor(0)).toBe(scoreColor(20))
    expect(scoreColor(81)).toBe(scoreColor(100))
  })
})
