/**
 * How each capture that measures against Godot launches its browser. The launch needs Chromium,
 * so the seam under test is each capture's source: its one launch is the shared helper. A capture
 * is any script outside the golden harness that builds a capture context.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPTS = resolve(import.meta.dirname, '..');
const NOT_GODOT_COMPARISON = new Set(['visual', 'output', 'node_modules']);

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return NOT_GODOT_COMPARISON.has(entry.name) ? [] : sourceFiles(path);
    return entry.name.endsWith('.mjs') && !entry.name.endsWith('.test.mjs') ? [path] : [];
  });
}

const GODOT_COMPARISON_CAPTURES = sourceFiles(SCRIPTS)
  .filter((path) => readFileSync(path, 'utf8').includes('createCaptureContext('))
  .map((path) => relative(SCRIPTS, path));

function launchCalls(capture) {
  return readFileSync(join(SCRIPTS, capture), 'utf8')
    .split('\n')
    .filter((line) => /launch\w*\(/.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line))
    .map((line) => line.trim());
}

describe('a capture that measures against Godot', () => {
  it('is found by its capture context', () => {
    expect(GODOT_COMPARISON_CAPTURES).toContain('godot-ref/capture-ours.mjs');
  });

  it.each(GODOT_COMPARISON_CAPTURES)('%s launches only through the shared helper', (capture) => {
    expect(launchCalls(capture)).toEqual(['browser = await launchGodotComparisonBrowser();']);
  });
});
