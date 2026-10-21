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
    expect(pageSpecFor(scene('plain'))).toEqual({ key: 'default', options: { frameOnOpen: true } });
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

describe('openPagePool', () => {
  it('opens one page for each distinct kind of scene, and none for a kind no scene needs', async () => {
    const contexts = stubContexts();
    const scenes = [scene('a'), scene('b'), scene('c', { canvas: { width: 96, height: 96 } })];

    await openPagePool({}, scenes);

    expect(contexts).toHaveLength(2);
  });

  it('gives a scene the page of its kind', async () => {
    stubContexts();
    const small = scene('small', { canvas: { width: 96, height: 96 } });
    const pool = await openPagePool({}, [scene('plain'), small]);

    expect(pool.pageFor(small)).not.toBe(pool.pageFor(scene('plain')));
    expect(pool.pageFor(scene('other'))).toBe(pool.pageFor(scene('plain')));
  });

  it('closes a page after the last scene that uses it, and not before', async () => {
    const contexts = stubContexts();
    const first = scene('first', { canvas: { width: 96, height: 96 } });
    const second = scene('second', { canvas: { width: 96, height: 96 } });
    const pool = await openPagePool({}, [first, second]);

    await pool.release(first);
    expect(contexts[0].close).not.toHaveBeenCalled();
    await pool.release(second);
    expect(contexts[0].close).toHaveBeenCalledOnce();
  });
});
