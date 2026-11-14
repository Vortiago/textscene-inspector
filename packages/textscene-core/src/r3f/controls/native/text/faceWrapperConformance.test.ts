/**
 * Drift guard: a face wrapper that changes the advance of a character declares that character drawn
 * apart. The run shaping is the one source of a shaped glyph's advance (`getFontRunGlyphAdvancePx`),
 * so a wrapper's `getGlyphAdvanceUnits` reaches the layout only for a character outside the run
 * shaping. Without `drawsApart`, the override holds only on a face with no `shaping`.
 */
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { callSites, isProductionSource, reportOffenders, walkSources } from '../../../testing/sourceScan';

const CORE_SOURCE_ROOT = join(import.meta.dirname, '../../../..');

/** Lines of an `Object.create` whose properties define `getGlyphAdvanceUnits` and no `drawsApart`. */
function undeclaredAdvanceLines(source: string): number[] {
  return callSites(source, /\bObject\.create\(/)
    .filter(({ args: [, properties = ''] }) => changesUndeclaredAdvance(properties))
    .map(({ line }) => line);
}

/** Whether the property map `properties` changes `getGlyphAdvanceUnits` and declares no `drawsApart`. */
function changesUndeclaredAdvance(properties: string): boolean {
  return /\bgetGlyphAdvanceUnits\b/.test(properties) && !/\bdrawsApart\b/.test(properties);
}

describe('face wrapper conformance', () => {
  it('finds a wrapper that changes an advance and declares no character drawn apart', () => {
    const wrapper = [
      'const wide = Object.create(face, {',
      '  getGlyphAdvanceUnits: { value: () => face.unitsPerEm },',
      '});',
    ].join('\n');
    expect(undeclaredAdvanceLines(wrapper)).toEqual([1]);
  });

  it('passes a wrapper that declares the characters it changes drawn apart', () => {
    const wrapper = [
      'const wide = Object.create(face, {',
      "  drawsApart: { value: (ch) => ch === '\\ufffc' },",
      '  getGlyphAdvanceUnits: { value: () => face.unitsPerEm },',
      '});',
    ].join('\n');
    expect(undeclaredAdvanceLines(wrapper)).toEqual([]);
  });

  it('holds for every face wrapper in the production sources', () => {
    const sources = walkSources([CORE_SOURCE_ROOT], isProductionSource);
    const offenders = reportOffenders(sources, undeclaredAdvanceLines);
    expect(
      offenders,
      `these wrappers change an advance the run shaping ignores. Declare the characters in \`drawsApart\`: ${offenders.join(', ')}`
    ).toEqual([]);
  });
});
