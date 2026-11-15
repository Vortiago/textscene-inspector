/**
 * The off-screen target primitives live in `r3f/offscreen/`. No file outside `nodes/viewport/`
 * imports one from the SubViewport slice, and the module imports nothing from `nodes/`.
 */
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isProductionSource, repoPath, walkSources } from '../testing/sourceScan';

const SRC = join(import.meta.dirname, '../..');
const VIEWPORT_SLICE = join(SRC, 'nodes/viewport');
const OFFSCREEN = join(SRC, 'r3f/offscreen');

const PRIMITIVES = [
  'createSceneTarget',
  'createCanvasTarget',
  'createLinearCanvasTarget',
  'storeSrgbBytes',
  'renderToOffscreenTarget',
  'clearTarget',
  'drawOffscreen',
  'BLACK',
  'useMultisampledTarget',
];

/**
 * Each `import … from` and `export … from` clause with the path it resolves to, so a re-export
 * counts too. A braced list may span lines.
 */
function importsOf(file: string, source: string): { clause: string; target: string }[] {
  return [...source.matchAll(/(?:^|\n)\s*(?:import|export)\b([^;]*?)from\s*['"]([^'"]+)['"]/g)].map(
    (match) => ({
      clause: match[1] ?? '',
      target: resolve(dirname(file), match[2] ?? ''),
    })
  );
}

const isTsSource = (name: string) => /\.tsx?$/.test(name);

describe('the off-screen target module', () => {
  const sources = walkSources([SRC], isTsSource);

  it('finds the module, so the scan cannot pass vacuously', () => {
    expect(sources.some(({ file }) => file.startsWith(OFFSCREEN))).toBe(true);
  });

  it.each(PRIMITIVES)('is where every file outside nodes/viewport/ imports %s from', (primitive) => {
    const importers = sources
      .filter(({ file }) => !file.startsWith(VIEWPORT_SLICE + '/'))
      .filter(({ file, source }) =>
        importsOf(file, source).some(
          ({ clause, target }) =>
            new RegExp(`\\b${primitive}\\b`).test(clause) && target.startsWith(VIEWPORT_SLICE + '/')
        )
      )
      .map(({ file }) => repoPath(file));
    expect(importers).toEqual([]);
  });

  it('imports nothing from nodes/', () => {
    const offenders = walkSources([OFFSCREEN], isProductionSource)
      .filter(({ file, source }) =>
        importsOf(file, source).some(({ target }) => target.startsWith(join(SRC, 'nodes') + '/'))
      )
      .map(({ file }) => repoPath(file));
    expect(offenders).toEqual([]);
  });
});
