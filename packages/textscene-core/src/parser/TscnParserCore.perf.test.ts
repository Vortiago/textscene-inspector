/**
 * Perf regression test for multi-line property value scanning.
 *
 * `TscnParserCore` accumulates an unterminated string/array value across
 * physical lines (`multilineStrings.test.ts` pins the correctness contract).
 * The accumulation used to be O(L^2) in the number of lines the value spans:
 * each new line re-concatenated the whole growing string (`+=`) AND
 * `isIncompleteValue` rescanned that whole string from index 0. Measured on
 * the unfixed code: 5k lines ~7.7s, 20k lines ~119s — catastrophic on large
 * or pathological scenes (a single huge multi-line label/BBCode value).
 *
 * This test builds a large multi-line string value and asserts the parse
 * completes within a generous absolute ceiling. A ratio-based assertion would
 * work too, but an absolute bound is the more robust discriminator here: the
 * blowup is dramatic (100x+ over a 4x input growth), so a wide margin still
 * cleanly separates "fixed" from "still quadratic" on any CI machine without
 * being sensitive to timer noise the way a small-vs-small ratio would be.
 */

import { describe, expect, it } from 'vitest';
import { TscnParser } from './TscnParser';
import type { LabelProperties } from '../nodes/2d/ui/label/types';

/** Build a `.tscn` document whose Label `text` spans `lineCount` physical lines. */
function buildMultilineScene(lineCount: number): string {
  const bodyLines: string[] = [];
  for (let i = 0; i < lineCount; i++) {
    // Vary content slightly so the accumulated value isn't trivially
    // compressible/cacheable by an unrelated optimization.
    bodyLines.push(`Line number ${i} of a very long pathological label value.`);
  }

  return [
    '[gd_scene format=3]',
    '',
    '[node name="Title" type="Label"]',
    `text = "${bodyLines[0]}`,
    ...bodyLines.slice(1),
    `${bodyLines[lineCount - 1]}"`,
    'horizontal_alignment = 1',
    '',
  ].join('\n');
}

describe('multi-line value scanning performance', () => {
  it('parses a scene with a very long multi-line string value within a generous bound', () => {
    const LINE_COUNT = 20000; // matches the catastrophic case measured on the unfixed parser
    const content = buildMultilineScene(LINE_COUNT);

    const start = performance.now();
    const scene = new TscnParser().parse(content);
    const elapsedMs = performance.now() - start;

    // Sanity: still parses correctly (the multi-line value still rejoins and
    // parsing continues past it) — the perf fix must not change output.
    const title = scene.nodes.find(n => n.name === 'Title')?.properties as
      | LabelProperties
      | undefined;
    expect(title?.text).toContain('Line number 0 of a very long pathological label value.');
    expect(title?.horizontalAlignment).toBe(1);

    // O(L) target: comfortably under a second on any reasonable machine.
    // O(L^2) on the unfixed code took ~119s at this size — this bound is
    // ~50x the expected fixed-code time yet ~50x below the broken time,
    // cleanly separating the two without being sensitive to timer noise.
    expect(elapsedMs).toBeLessThan(2000);
  });
});
