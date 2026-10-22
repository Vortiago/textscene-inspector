/**
 * How each harness launches its browser. The launch needs Chromium, so the seam under test is each
 * harness's source: it calls a launch from `browser.mjs`. A capture that measures against Godot is
 * any script under godot-ref or compare-docs that opens a preview session.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPTS = resolve(import.meta.dirname, '..');
const GODOT_COMPARISON_DIRS = ['godot-ref', 'compare-docs'];

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.mjs') && !entry.name.endsWith('.test.mjs') ? [path] : [];
  });
}

const GODOT_COMPARISON_CAPTURES = GODOT_COMPARISON_DIRS.flatMap((dir) => sourceFiles(join(SCRIPTS, dir)))
  .filter((path) => readFileSync(path, 'utf8').includes('withPreviewBrowser('))
  .map((path) => relative(SCRIPTS, path));

const source = (capture) => readFileSync(join(SCRIPTS, capture), 'utf8');

describe('a capture that measures against Godot', () => {
  it('is found by its preview session', () => {
    expect(GODOT_COMPARISON_CAPTURES).toContain('godot-ref/capture-ours.mjs');
  });

  it.each(GODOT_COMPARISON_CAPTURES)('%s opens its session with the shared launch', (capture) => {
    expect(source(capture)).toContain('launchBrowser: launchGodotComparisonBrowser');
  });

  it.each(GODOT_COMPARISON_CAPTURES)('%s builds no launch of its own', (capture) => {
    expect(source(capture)).not.toMatch(/chromium\.launch\(/);
  });
});

describe('a Chromium launch', () => {
  const launchers = sourceFiles(SCRIPTS)
    .filter((path) => /chromium\.launch\(/.test(readFileSync(path, 'utf8')))
    .map((path) => relative(SCRIPTS, path));

  it('lives only in browser.mjs, so each flag set has one launch', () => {
    expect(launchers).toEqual(['showcase/browser.mjs']);
  });
});
