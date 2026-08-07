/**
 * Unit tests for the pure/testable pieces of the visual-regression harness.
 *
 * The harness's correctness is mostly "did the browser render the right
 * pixels", which only a real Chromium + SwiftShader can answer — covered by
 * `pnpm test:visual` itself, not here. What IS testable in isolation:
 *
 * - `isUniformImage`: the guard that stops `--update` writing a dead-context
 *   or unrendered-scene capture as a baseline (a uniform image settles just
 *   as cleanly as a real one, so pixel-settling alone cannot catch this).
 * - `captureScene`'s seam selection: a `mode: '2d'` scene must route through
 *   the canvas2D page/context and target, never the default 3D one, and a
 *   console error logged during any scene's capture must fail it even when
 *   its pixels settled and look plausible.
 *
 * `previewServer.mjs` is mocked throughout so these run with no browser at
 * all — the module's OWN correctness (does `findCaptureTarget` actually find
 * the right element in a real page) is covered by the real-browser gate
 * (`pnpm test:visual`), not duplicated here.
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
import { captureScene, isUniformImage, pixelsMatchBaseline } from './run.mjs';

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

describe('isUniformImage', () => {
  it('flags a capture that is a single colour throughout as uniform', () => {
    expect(isUniformImage(uniformPngBuffer(8, 8))).toBe(true);
  });

  it('does not flag a capture carrying any real content', () => {
    const png = PNG.sync.read(uniformPngBuffer(8, 8));
    // One pixel breaks uniformity — the guard must not need more than that.
    const idx = (4 * 8 + 4) * 4;
    png.data[idx] = 255;
    png.data[idx + 1] = 0;
    png.data[idx + 2] = 0;
    expect(isUniformImage(PNG.sync.write(png))).toBe(false);
  });

  it('treats a single-pixel image as uniform (nothing to disagree with it)', () => {
    expect(isUniformImage(uniformPngBuffer(1, 1))).toBe(true);
  });
});

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
    // Simulate a console/pageerror listener firing DURING the settle — after
    // captureScene has already cleared the array for this scene, exactly as a
    // real page event would.
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
 * `--update` writes every scene, so without this guard a rebaseline that moved
 * four images arrives as thirteen changed binaries and "eyeball the rebaselined
 * images" turns into finding the four that mean something. Measured on the
 * cpuparticles2d rebaseline: seven of the nine collateral scenes read 0 px
 * differ in the very same run — identical pixels, different PNG bytes.
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
    // Same pixels, different row filter — the cheap byte compare calls these
    // different files, which is the wrong answer for a baseline.
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
    // A truncated or non-PNG baseline must not throw mid-run and must not be
    // mistaken for a match — anything unprovable gets rewritten.
    expect(pixelsMatchBaseline(Buffer.from('not a png'), uniformPngBuffer(8, 8))).toBe(false);
  });
});
