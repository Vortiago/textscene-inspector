/**
 * `bandBase`/`controlRenderOrder` pin the draw-order invariants the module
 * doc derives (`controlDrawOrder.ts`): every native Control's paint position
 * comes from `renderOrder`, never a z offset, because every 2D material here
 * is transparent + depthWrite=false and three's transparent sort consults
 * `renderOrder` before camera distance.
 */
import { describe, expect, it } from 'vitest';
import { bandBase, controlRenderOrder, DRAW_ORDER_BAND_STRIDE } from './controlDrawOrder';

describe('bandBase', () => {
  it('places layer-0 UI (no enclosing CanvasLayer) strictly above the world default renderOrder 0', () => {
    // Every 2D-world mesh leaves `renderOrder` at three's own default, 0
    // (nothing in `NodeDispatcher`'s render tree ever sets it) — a native
    // Control with no enclosing `CanvasLayer` (ambient layer 0,
    // `WORLD_CANVAS_LAYER`) must still out-paint that by construction.
    expect(bandBase(0)).toBeGreaterThan(0);
  });

  it('is strictly monotonic in layer, across negative, zero, and positive layers', () => {
    const layers = [-5, -2, -1, 0, 1, 2, 10];
    const bases = layers.map(bandBase);
    for (let i = 1; i < bases.length; i++) {
      expect(bases[i]!).toBeGreaterThan(bases[i - 1]!);
    }
  });

  it('gives every negative CanvasLayer a band strictly below the world default', () => {
    // Godot's `layer < 0` draws BEFORE (under) the default canvas.
    for (const layer of [-1, -2, -100, -1000]) {
      expect(bandBase(layer)).toBeLessThan(0);
    }
  });

  it('never assigns band 0 to any layer, leaving it reserved for the world default', () => {
    for (const layer of [-3, -2, -1, 0, 1, 2, 3]) {
      expect(bandBase(layer)).not.toBe(0);
    }
  });

  it('spaces bands wider than the largest paintIndex a single band could ever hold', () => {
    // `paintIndex` (`controlRectSolver.ts`'s `assignPaintIndex`) is ONE
    // counter across the whole tree passed to a solve, not reset per
    // CanvasLayer — a scene where every Control lives under the SAME layer
    // could hand that layer a paintIndex right up to the stride's own width.
    // The band must swallow that without ever reaching its neighbour.
    const largestPlausiblePaintIndex = DRAW_ORDER_BAND_STRIDE - 1;
    expect(bandBase(0) + largestPlausiblePaintIndex).toBeLessThan(bandBase(1));
    expect(bandBase(-1) + largestPlausiblePaintIndex).toBeLessThan(bandBase(0));
  });

  it('keeps renderOrder inside Number.MAX_SAFE_INTEGER across the full CanvasLayer.layer envelope', () => {
    // `RS::CANVAS_LAYER_MIN`/`CANVAS_LAYER_MAX`
    // (servers/rendering/rendering_server.h) is Godot's full int32 range for
    // `CanvasLayer.layer` — a PROPERTY_HINT_RANGE, not a value clamp (same
    // caveat as `z_index`), but still the envelope this stride is sized
    // against (see module doc).
    const INT32_MAX = 2147483647;
    const INT32_MIN = -2147483648;
    expect(Math.abs(bandBase(INT32_MAX))).toBeLessThan(Number.MAX_SAFE_INTEGER);
    expect(Math.abs(bandBase(INT32_MIN))).toBeLessThan(Number.MAX_SAFE_INTEGER);
  });
});

describe('controlRenderOrder', () => {
  it('adds paintIndex on top of the enclosing layer band', () => {
    expect(controlRenderOrder(0, 5)).toBe(bandBase(0) + 5);
    expect(controlRenderOrder(-1, 42)).toBe(bandBase(-1) + 42);
  });
});
