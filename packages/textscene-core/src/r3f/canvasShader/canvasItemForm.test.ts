import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { repoRoot } from '../../parser/testing/parserKit';
import { isProductionSource, walkSources } from '../testing/sourceScan';

/** The form a fresh load of the module reads, on a page at `url`. */
async function formOnPageAt(url: string) {
  window.history.replaceState(null, '', url);
  vi.resetModules();
  const { canvasItemForm } = await import('./canvasItemForm');
  return canvasItemForm();
}

describe('canvasItemForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  });

  it('answers translated on a page opened with ?canvasItem=translated', async () => {
    expect(await formOnPageAt('/?fixture=a.tscn&canvasItem=translated')).toBe('translated');
  });

  it('answers classic on a page with no parameter', async () => {
    expect(await formOnPageAt('/?fixture=a.tscn')).toBe('classic');
  });

  it('answers classic for a value that names no form', async () => {
    expect(await formOnPageAt('/?canvasItem=other')).toBe('classic');
  });

  it('keeps the form it loaded with for the life of the page', async () => {
    await formOnPageAt('/?canvasItem=translated');
    window.history.replaceState(null, '', '/?canvasItem=classic');
    const { canvasItemForm } = await import('./canvasItemForm');

    expect(canvasItemForm()).toBe('translated');
  });

  it('answers classic with no window', async () => {
    vi.stubGlobal('window', undefined);
    vi.resetModules();
    const { canvasItemForm } = await import('./canvasItemForm');

    expect(canvasItemForm()).toBe('classic');
  });
});

/** The production sources a reader of the switch can sit in. */
const SOURCE_ROOTS = ['packages', 'apps'].map((root) => join(repoRoot(), root));

describe('the switch has one reader', () => {
  it('is imported by at most one production file', () => {
    const readers = walkSources(SOURCE_ROOTS, isProductionSource)
      .filter(({ file }) => !file.endsWith(join('canvasShader', 'canvasItemForm.ts')))
      .filter(({ source }) => /\bfrom\s+['"][^'"]*\/canvasItemForm(\.js)?['"]/.test(source));

    expect(readers.length).toBeLessThanOrEqual(1);
  });
});
