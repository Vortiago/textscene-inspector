/**
 * Multi-line value accumulation in `TscnParserCore` stays O(total length).
 * `multilineStrings.test.ts` pins correctness. A quadratic scan takes about 119s at
 * 20k lines, so an absolute ceiling separates the two on any CI machine without the
 * timer noise a small-versus-small ratio has.
 */

import { describe, expect, it } from 'vitest';
import { TscnParser } from './TscnParser';

/** Build a `.tscn` document whose Label `text` spans `lineCount` physical lines. */
function buildMultilineScene(lineCount: number): string {
  const bodyLines: string[] = [];
  for (let i = 0; i < lineCount; i++) {
    // Varied content, so no unrelated optimisation can compress or cache the value.
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

    // The value still rejoins and parsing continues past it.
    const title = scene.nodes.find(n => n.name === 'Title');
    const titleProps = title?.properties as Record<string, unknown> | undefined;
    expect(titleProps?.text).toContain('Line number 0 of a very long pathological label value.');
    expect(titleProps?.horizontalAlignment).toBe(1);

    // O(L) runs well under a second. O(L^2) takes about 119s at this size, so the
    // bound sits about 50x from each.
    expect(elapsedMs).toBeLessThan(2000);
  });
});
