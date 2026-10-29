/**
 * Tests the lazy-only check of the webview budget: a module that loads on demand must stay off the
 * canvas-paint closure, whatever the closure's total size.
 */
import { describe, expect, it } from 'vitest';
import { findEagerLazyOnlyInputs } from './webviewBudget.mjs';

const LTC_TABLE = '../../packages/textscene-core/dist/godot/rendering/lights/ltcTable.generated.js';
const FASTNOISE =
  '../../node_modules/.pnpm/fastnoise-lite@1.1.1/node_modules/fastnoise-lite/FastNoiseLite.js';
const PARSER = '../../packages/textscene-core/dist/parser/sceneTreeBuilder.js';
const PANEL = '../../packages/textscene-core/dist/r3f/components/SceneTreeViewer/SceneTreeViewer.js';

function metafile(outputs) {
  return {
    outputs: Object.fromEntries(
      Object.entries(outputs).map(([file, inputs]) => [
        `dist/webview/${file}`,
        { inputs: Object.fromEntries(inputs.map((input) => [input, { bytesInOutput: 100 }])) },
      ])
    ),
  };
}

describe('findEagerLazyOnlyInputs', () => {
  it('names each lazy-only module that a closure file holds', () => {
    const meta = metafile({ 'webview.js': [PARSER, LTC_TABLE], 'chunks/chunk-A.js': [FASTNOISE] });
    expect(findEagerLazyOnlyInputs(meta, new Set(['webview.js', 'chunks/chunk-A.js']))).toEqual([
      LTC_TABLE,
      FASTNOISE,
    ]);
  });

  it('names a module that a dynamic import() reaches', () => {
    const meta = {
      ...metafile({ 'webview.js': [PARSER, PANEL] }),
      inputs: { [PARSER]: { imports: [{ path: PANEL, kind: 'dynamic-import' }] }, [PANEL]: {} },
    };
    expect(findEagerLazyOnlyInputs(meta, new Set(['webview.js']))).toEqual([PANEL]);
  });

  it('passes a lazy-only module that only a chunk outside the closure holds', () => {
    const meta = metafile({ 'webview.js': [PARSER], 'chunks/ltcTextures-B.js': [LTC_TABLE] });
    expect(findEagerLazyOnlyInputs(meta, new Set(['webview.js']))).toEqual([]);
  });
});
