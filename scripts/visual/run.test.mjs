/**
 * Tests the visual harness without a browser, with `previewServer.mjs` mocked: a `mode: '2d'`
 * scene routes through the canvas2D page and target, and a console error fails a settled capture.
 * The rendered pixels and `previewServer.mjs` itself need a real Chromium with SwiftShader, which
 * `pnpm test:visual` provides.
 */
import { describe, expect, it, vi } from 'vitest';
import { PNG } from 'pngjs';

vi.mock('./previewServer.mjs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    gotoFixture: vi.fn(),
    findCaptureTarget: vi.fn(),
    setDisplayToggle: vi.fn(),
    settleCanvas: vi.fn(),
  };
});

import { findCaptureTarget, gotoFixture, settleCanvas } from './previewServer.mjs';
import { captureScene } from './run/sceneCapture.mjs';
import { pixelsMatchBaseline } from './run/baselines.mjs';

function uniformPngBuffer(width, height, [r, g, b, a] = [30, 60, 90, 255]) {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = r;
    png.data[i + 1] = g;
    png.data[i + 2] = b;
    png.data[i + 3] = a;
  }
  return PNG.sync.write(png);
}

describe('captureScene seam selection', () => {
  function fakePages() {
    return {
      default: { page: { name: '3d-page' }, errors: [] },
      canvas2D: { page: { name: '2d-page' }, errors: [] },
    };
  }

  function stubHappyCapture() {
    findCaptureTarget.mockResolvedValue({ target: { screenshot: vi.fn() }, reason: null });
    settleCanvas.mockResolvedValue({ buffer: Buffer.from('captured'), reason: null });
  }

  it('routes a mode: "2d" scene through the canvas2D page and target', async () => {
    stubHappyCapture();
    const pages = fakePages();
    const scene = { name: 'two-d-scene', file: 'unit-two-d.tscn', mode: '2d' };

    const result = await captureScene(pages, 'http://localhost:1', scene);

    expect(result.buffer).not.toBeNull();
    expect(gotoFixture).toHaveBeenCalledWith(
      pages.canvas2D.page,
      'http://localhost:1',
      'unit-two-d.tscn',
      expect.any(Function)
    );
    expect(findCaptureTarget).toHaveBeenCalledWith(pages.canvas2D.page, { canvas2D: true });
    expect(settleCanvas).toHaveBeenCalledWith(
      pages.canvas2D.page,
      expect.anything()
    );
    // Never touches the 3D page at all.
    expect(gotoFixture).not.toHaveBeenCalledWith(
      pages.default.page,
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });

  it('routes a scene with no mode field through the default 3D page and target', async () => {
    stubHappyCapture();
    const pages = fakePages();
    const scene = { name: 'three-d-scene', file: 'unit-three-d.tscn' };

    await captureScene(pages, 'http://localhost:1', scene);

    expect(gotoFixture).toHaveBeenCalledWith(
      pages.default.page,
      'http://localhost:1',
      'unit-three-d.tscn',
      expect.any(Function)
    );
    expect(findCaptureTarget).toHaveBeenCalledWith(pages.default.page, { canvas2D: false });
  });

  it('throws rather than silently falling back to 3D when no canvas2D context exists', async () => {
    stubHappyCapture();
    const pages = { default: { page: {}, errors: [] }, canvas2D: null };
    const scene = { name: 'two-d-scene', file: 'unit-two-d.tscn', mode: '2d' };

    await expect(captureScene(pages, 'http://localhost:1', scene)).rejects.toThrow(
      /canvas2D capture context/
    );
  });
});

describe('captureScene console-error gate', () => {
  it('fails a scene whose capture logged a console error, even though it settled', async () => {
    findCaptureTarget.mockResolvedValue({ target: { screenshot: vi.fn() }, reason: null });
    const pages = {
      default: { page: {}, errors: [] },
      canvas2D: null,
    };
    // A console or pageerror listener fires during the settle, after captureScene has cleared the
    // array for this scene, as a real page event would.
    settleCanvas.mockImplementation(async () => {
      pages.default.errors.push('TypeError: something.broke is not a function');
      return { buffer: Buffer.from('captured'), reason: null };
    });

    const result = await captureScene(pages, 'http://localhost:1', {
      name: 'noisy-scene',
      file: 'unit-noisy.tscn',
    });

    expect(result.buffer).toBeNull();
    expect(result.reason).toMatch(/something\.broke is not a function/);
  });

  it('passes a scene whose capture logged no console errors', async () => {
    findCaptureTarget.mockResolvedValue({ target: { screenshot: vi.fn() }, reason: null });
    settleCanvas.mockResolvedValue({ buffer: Buffer.from('captured'), reason: null });
    const pages = { default: { page: {}, errors: [] }, canvas2D: null };

    const result = await captureScene(pages, 'http://localhost:1', {
      name: 'quiet-scene',
      file: 'unit-quiet.tscn',
    });

    expect(result.buffer).not.toBeNull();
  });

  it('clears errors left over from a PREVIOUS scene captured on the same page', async () => {
    findCaptureTarget.mockResolvedValue({ target: { screenshot: vi.fn() }, reason: null });
    settleCanvas.mockResolvedValue({ buffer: Buffer.from('captured'), reason: null });
    const pages = {
      default: { page: {}, errors: ['stale error from a previous scene'] },
      canvas2D: null,
    };

    const result = await captureScene(pages, 'http://localhost:1', {
      name: 'next-scene',
      file: 'unit-next.tscn',
    });

    expect(result.buffer).not.toBeNull();
  });
});

/**
 * `--update` captures every scene, and an unchanged render can re-encode to new PNG bytes, so
 * without this guard the images that moved would hide among rewritten ones.
 */
describe('pixelsMatchBaseline', () => {
  it('sees through an encode that changed the bytes but not the pixels', () => {
    const png = new PNG({ width: 16, height: 16 });
    for (let i = 0; i < png.data.length; i += 4) {
      png.data[i] = (i * 7) % 256;
      png.data[i + 1] = (i * 13) % 256;
      png.data[i + 2] = (i * 29) % 256;
      png.data[i + 3] = 255;
    }
    const original = PNG.sync.write(png);
    // Same pixels, different row filter: a byte compare calls these different files, which is the
    // wrong answer for a baseline.
    const reencoded = PNG.sync.write(PNG.sync.read(original), { filterType: 0 });
    expect(reencoded.equals(original)).toBe(false);
    expect(pixelsMatchBaseline(original, reencoded)).toBe(true);
  });

  it('reports a single changed pixel, so a real move is never skipped', () => {
    const baseline = uniformPngBuffer(8, 8);
    const png = PNG.sync.read(baseline);
    png.data[(4 * 8 + 4) * 4] = 255;
    expect(pixelsMatchBaseline(baseline, PNG.sync.write(png))).toBe(false);
  });

  it('reports a size change rather than comparing mismatched buffers', () => {
    expect(pixelsMatchBaseline(uniformPngBuffer(8, 8), uniformPngBuffer(8, 16))).toBe(false);
  });

  it('writes when there is no baseline to compare against (edge case)', () => {
    expect(pixelsMatchBaseline(null, uniformPngBuffer(8, 8))).toBe(false);
  });

  it('writes when the existing baseline cannot be decoded (error case)', () => {
    // A truncated or non-PNG baseline neither throws mid-run nor counts as a match: anything
    // unprovable gets rewritten.
    expect(pixelsMatchBaseline(Buffer.from('not a png'), uniformPngBuffer(8, 8))).toBe(false);
  });
});
