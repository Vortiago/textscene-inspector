/**
 * Tests the page pool without a browser, with `previewServer.mjs` mocked: which page each scene
 * gets, and when a page closes.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../previewServer.mjs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    createCaptureContext: vi.fn(),
    attachDiagnostics: vi.fn(() => ({ consoleErrors: [] })),
  };
});

import { createCaptureContext } from '../previewServer.mjs';
import { GOLDEN_SCENES } from '../scenes.mjs';
import { openPagePool, pageSpecFor } from './pagePool.mjs';

const scene = (name, extra = {}) => ({ name, file: `${name}.tscn`, ...extra });

/** A context that records its options and whether it closed. */
function stubContexts() {
  const contexts = [];
  createCaptureContext.mockImplementation(async (_browser, options) => {
    const context = { options, page: { name: `page-${contexts.length}` }, close: vi.fn() };
    context.newPage = async () => context.page;
    contexts.push(context);
    return context;
  });
  return contexts;
}

describe('pageSpecFor', () => {
  it('frames a 3D scene in the default window', () => {
    expect(pageSpecFor(scene('plain'))).toEqual({
      key: '955x756',
      options: { frameOnOpen: true, viewport: { width: 1280, height: 800 } },
    });
  });

  it('opens a 2D scene on the 2D parity frame', () => {
    expect(pageSpecFor(scene('flat', { mode: '2d' }))).toEqual({
      key: '2d',
      options: { frameOnOpen: false, canvas2D: true },
    });
  });

  it('sizes the window for a scene that names a canvas', () => {
    const spec = pageSpecFor(scene('small', { canvas: { width: 200, height: 156 } }));
    expect(spec.key).toBe('200x156');
    expect(spec.options.viewport).toEqual({ width: 525, height: 200 });
  });

  it('rejects a 2D scene that names a canvas, naming the mode and the canvas', () => {
    expect(() => pageSpecFor(scene('both', { mode: '2d', canvas: { width: 96, height: 96 } }))).toThrow(
      /expected no canvas with mode "2d", got 96x96/
    );
  });
});

describe('the golden manifest', () => {
  it('gives every scene a page', () => {
    for (const goldenScene of GOLDEN_SCENES) expect(() => pageSpecFor(goldenScene)).not.toThrow();
  });
});

describe('openPagePool', () => {
  it('opens one page for each distinct kind of scene, and none for a kind no scene needs', async () => {
    const contexts = stubContexts();
    const scenes = [scene('a'), scene('b'), scene('c', { canvas: { width: 96, height: 96 } })];

    await openPagePool({}, scenes);

    expect(contexts).toHaveLength(2);
  });

  it("lists the scenes in run order: a page kind's scenes together, kinds by first appearance", async () => {
    stubContexts();
    const small = (name) => scene(name, { canvas: { width: 96, height: 96 } });
    const scenes = [
      scene('a'),
      small('x'),
      scene('b'),
      scene('flat', { mode: '2d' }),
      small('y'),
      scene('c'),
    ];

    const pool = await openPagePool({}, scenes);

    expect(pool.scenes.map((s) => s.name)).toEqual(['a', 'b', 'c', 'x', 'y', 'flat']);
  });

  it('keeps the order of a run of one kind', async () => {
    stubContexts();
    const plain = [scene('a'), scene('b'), scene('c')];

    expect((await openPagePool({}, plain)).scenes).toEqual(plain);
  });

  it("runs a capture on the page of the scene's kind", async () => {
    const contexts = stubContexts();
    const small = scene('small', { canvas: { width: 96, height: 96 } });
    const plain = scene('plain');
    const pool = await openPagePool({}, [plain, small]);

    const pageOf = (sceneToUse) => pool.use(sceneToUse, async (pageState) => pageState.page);

    expect(await pageOf(small)).toBe(contexts[1].page);
    expect(await pageOf(plain)).toBe(contexts[0].page);
  });

  it('closes a page after the last scene that uses it, and not before', async () => {
    const contexts = stubContexts();
    const first = scene('first', { canvas: { width: 96, height: 96 } });
    const second = scene('second', { canvas: { width: 96, height: 96 } });
    const pool = await openPagePool({}, [first, second]);

    await pool.use(first, async () => {});
    expect(contexts[0].close).not.toHaveBeenCalled();
    await pool.use(second, async () => {});
    expect(contexts[0].close).toHaveBeenCalledOnce();
  });

  it('closes a page when the capture throws', async () => {
    const contexts = stubContexts();
    const only = scene('only');
    const pool = await openPagePool({}, [only]);

    await expect(pool.use(only, async () => Promise.reject(new Error('settle failed')))).rejects.toThrow(
      'settle failed'
    );
    expect(contexts[0].close).toHaveBeenCalledOnce();
  });

  it('rejects a scene that was not in the run, naming it', async () => {
    stubContexts();
    const pool = await openPagePool({}, [scene('listed')]);

    await expect(pool.use(scene('stranger'), async () => {})).rejects.toThrow(
      /scene "stranger" has no open page/
    );
  });
});
