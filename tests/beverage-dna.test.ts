import { describe, it, expect } from 'vitest'
import { parseBeverageDNA } from '@/lib/agent/beverage-dna'

/** Wrap a JSON payload in the sentinel block the model emits. */
function block(json: string): string {
  return `Here's your pour.\n\n===DNA===\n${json}\n===END===`
}

const VALID = JSON.stringify({
  persona: 'The Bold Explorer',
  tasteLine: 'Because you go for bright, clean coffees with a little adventure…',
  flavorProfile: [
    { axis: 'Bright', value: 0.9 },
    { axis: 'Sweet', value: 0.3 },
  ],
  confidenceScore: 82,
  discoveryScore: 71,
  summary: 'You chase the fruit-forward, high-acidity end of the spectrum.',
})

describe('parseBeverageDNA', () => {
  it('returns null when there is no DNA block', () => {
    expect(parseBeverageDNA('just a normal reply, no sentinel here')).toBeNull()
  })

  it('returns null when the block JSON is malformed', () => {
    expect(parseBeverageDNA(block('{ persona: "The Bold Explorer", oops }'))).toBeNull()
  })

  it('parses a valid block into a normalised object', () => {
    const dna = parseBeverageDNA(block(VALID))!
    expect(dna.persona).toBe('The Bold Explorer')
    expect(dna.tasteLine).toBe('Because you go for bright, clean coffees with a little adventure…')
    expect(dna.flavorProfile).toEqual([
      { axis: 'Bright', value: 0.9 },
      { axis: 'Sweet', value: 0.3 },
    ])
    expect(dna.confidenceScore).toBe(82)
    expect(dna.discoveryScore).toBe(71)
    expect(dna.summary).toContain('fruit-forward')
  })

  it('ignores surrounding prose and a preceding REC block', () => {
    const text = `A warm handoff.\n===REC===\n{"recommendationName":"X"}\n===END===\n${block(VALID)}`
    expect(parseBeverageDNA(text)?.persona).toBe('The Bold Explorer')
  })

  it('drops the whole object when persona is off-list (analytics integrity)', () => {
    const bad = JSON.stringify({ persona: 'The Hopster', tasteLine: 'x' })
    expect(parseBeverageDNA(block(bad))).toBeNull()
  })

  it('drops the whole object when tasteLine is missing or blank', () => {
    const noLine = JSON.stringify({ persona: 'The Comfort Seeker', tasteLine: '   ' })
    expect(parseBeverageDNA(block(noLine))).toBeNull()
  })

  it('clamps scores into 0-100 and rounds them', () => {
    const json = JSON.stringify({
      persona: 'The Flavor Hunter', tasteLine: 'because notes',
      confidenceScore: 140, discoveryScore: -10,
    })
    const dna = parseBeverageDNA(block(json))!
    expect(dna.confidenceScore).toBe(100)
    expect(dna.discoveryScore).toBe(0)
  })

  it('coerces stringy/NaN scores to numbers (0 when unparseable)', () => {
    const json = JSON.stringify({
      persona: 'The Refined Collector', tasteLine: 'because notes',
      confidenceScore: '67', discoveryScore: 'high',
    })
    const dna = parseBeverageDNA(block(json))!
    expect(dna.confidenceScore).toBe(67)
    expect(dna.discoveryScore).toBe(0)
  })

  it('clamps flavor values to 0-1, drops axis-less entries, caps at 6 axes', () => {
    const json = JSON.stringify({
      persona: 'The Curious Adventurer', tasteLine: 'because notes',
      flavorProfile: [
        { axis: 'A', value: 1.8 },     // clamp to 1
        { axis: 'B', value: -0.5 },    // clamp to 0
        { value: 0.5 },                // no axis — dropped
        { axis: 'C', value: 0.4 },
        { axis: 'D', value: 0.4 },
        { axis: 'E', value: 0.4 },
        { axis: 'F', value: 0.4 },
        { axis: 'G', value: 0.4 },     // beyond the 6-axis cap
      ],
    })
    const dna = parseBeverageDNA(block(json))!
    expect(dna.flavorProfile).toHaveLength(6)
    expect(dna.flavorProfile[0]).toEqual({ axis: 'A', value: 1 })
    expect(dna.flavorProfile[1]).toEqual({ axis: 'B', value: 0 })
    expect(dna.flavorProfile.map(f => f.axis)).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
  })

  it('defaults flavorProfile to [] and summary to "" when absent', () => {
    const json = JSON.stringify({ persona: 'The Smooth Traditionalist', tasteLine: 'because notes' })
    const dna = parseBeverageDNA(block(json))!
    expect(dna.flavorProfile).toEqual([])
    expect(dna.summary).toBe('')
  })

  it('strips ```json fences inside the block', () => {
    const fenced = '```json\n' + VALID + '\n```'
    expect(parseBeverageDNA(block(fenced))?.persona).toBe('The Bold Explorer')
  })
})
