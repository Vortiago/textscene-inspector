/**
 * How each capture that measures against Godot launches its browser. The launch needs Chromium,
 * so the seam under test is each capture's source: its one launch is the shared helper.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPTS = resolve(import.meta.dirname, '..');

const GODOT_COMPARISON_CAPTURES = [
  'godot-ref/capture-ours.mjs',
  'compare-docs/capture-complex.mjs',
  'compare-docs/capture/oursSide.mjs',
  'compare-docs/recapture/oursSide.mjs',
  'compare-docs/animation/previewFrames.mjs',
];

function launchCalls(capture) {
  return readFileSync(join(SCRIPTS, capture), 'utf8')
    .split('\n')
    .filter((line) => /launch\w*\(/.test(line))
    .map((line) => line.trim());
}

describe('a capture that measures against Godot', () => {
  it.each(GODOT_COMPARISON_CAPTURES)('%s launches only through the shared helper', (capture) => {
    expect(launchCalls(capture)).toEqual(['browser = await launchGodotComparisonBrowser();']);
  });
});
