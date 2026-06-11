import { describe, it, expect } from 'vitest'
import { computeScore, validateDimensions } from '../server/scoring.js'

// Golden regression values — pinned against Formula J as deployed.
// If these fail, the formula changed; that invalidates every historical
// score, percentile, and leaderboard entry. See CLAUDE.md "What NOT to Do".
describe('computeScore (Formula J)', () => {
  it('scores a routine-heavy desk job high', () => {
    expect(computeScore({
      routine_data_text: 70, structured_rule_analysis: 15, content_creation: 5,
      novel_problem_solving: 5, physical_and_environmental: 3, interpersonal_emotional: 2,
    })).toBe(84)
  })

  it('scores a physical/interpersonal job low', () => {
    expect(computeScore({
      routine_data_text: 5, structured_rule_analysis: 10, content_creation: 0,
      novel_problem_solving: 15, physical_and_environmental: 55, interpersonal_emotional: 15,
    })).toBe(7)
  })

  it('scores a balanced cognitive mix in the middle band', () => {
    expect(computeScore({
      routine_data_text: 20, structured_rule_analysis: 25, content_creation: 30,
      novel_problem_solving: 15, physical_and_environmental: 5, interpersonal_emotional: 5,
    })).toBe(64)
  })

  it('handles boundary inputs', () => {
    const zero = { routine_data_text: 0, structured_rule_analysis: 0, content_creation: 0, novel_problem_solving: 0, physical_and_environmental: 0, interpersonal_emotional: 0 }
    expect(computeScore(zero)).toBe(0)
    expect(computeScore({ ...zero, routine_data_text: 100 })).toBe(100)
    expect(computeScore({ ...zero, physical_and_environmental: 100 })).toBe(0)
  })

  it('treats missing dimensions as zero', () => {
    expect(computeScore({})).toBe(0)
  })

  it('always returns an integer clamped to 0-100', () => {
    for (let i = 0; i <= 100; i += 10) {
      const s = computeScore({
        routine_data_text: i, structured_rule_analysis: 100 - i, content_creation: 0,
        novel_problem_solving: 0, physical_and_environmental: 0, interpersonal_emotional: 0,
      })
      expect(Number.isInteger(s)).toBe(true)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(100)
    }
  })
})

describe('validateDimensions', () => {
  const valid = {
    routine_data_text: 30, structured_rule_analysis: 20, content_creation: 20,
    novel_problem_solving: 10, physical_and_environmental: 10, interpersonal_emotional: 10,
  }

  it('accepts a complete integer dimension set', () => {
    expect(validateDimensions(valid).valid).toBe(true)
  })

  it('rejects missing object, missing keys, non-integers, and out-of-range values', () => {
    expect(validateDimensions(null).valid).toBe(false)
    expect(validateDimensions({ ...valid, routine_data_text: undefined }).valid).toBe(false)
    expect(validateDimensions({ ...valid, content_creation: 12.5 }).valid).toBe(false)
    expect(validateDimensions({ ...valid, content_creation: '20' }).valid).toBe(false)
    expect(validateDimensions({ ...valid, novel_problem_solving: -1 }).valid).toBe(false)
    expect(validateDimensions({ ...valid, novel_problem_solving: 101 }).valid).toBe(false)
  })
})
