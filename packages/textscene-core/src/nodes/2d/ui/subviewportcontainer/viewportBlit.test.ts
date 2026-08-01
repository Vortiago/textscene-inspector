/**
 * The pure half of the surface blit. Everything here is decidable without a GL
 * context or a canvas rasteriser; the visible result is asserted in a real
 * browser by `scripts/showcase/verify-2d.mjs` (ADR-0024), which is the only
 * place `putImageData` actually paints.
 *
 * Both encode assertions are paired with a measured Godot 4.6.3 render of
 * `scenes/fixtures/unit-sub-viewport-container-2d-content.tscn`:
 *
 *   pnpm ref:godot scenes/fixtures/unit-sub-viewport-container-2d-content.tscn \
 *     --probe 200,100 --probe 280,210
 *   probe 200,100 → rgb(127, 127, 127)   the Band, authored Color(0.5, 0.5, 0.5)
 *   probe 280,210 → rgb(76, 76, 76)      the uncovered clear colour
 */

import { describe, expect, it } from 'vitest';

import { encodeTargetPixels } from './viewportBlit';

/** A 1x1 ImageData carrying one RGBA quadruple. */
function pixel(r: number, g: number, b: number, a = 255): ImageData {
  return new ImageData(new Uint8ClampedArray([r, g, b, a]), 1, 1);
}

describe('encodeTargetPixels', () => {
  describe('the linear → sRGB encode the DOM cannot do for us', () => {
    /**
     * `createOffscreenTarget` tags the target `LinearSRGBColorSpace`, and with
     * `isXRRenderTarget` set three takes the pass's output space from that tag
     * — so the target stores WORKING-space values with no OETF applied. A 2D
     * canvas reads `putImageData` bytes as sRGB. The encode is the missing
     * step, and the sub-viewport's own clear colour calibrates it: Godot's
     * `default_clear_color` is sRGB Color(0.3, 0.3, 0.3), which enters the
     * target as linear 0.0732 → byte 19, and must leave the blit as the
     * rgb(77, 77, 77) `SubViewportContainer` already paints in DOM.
     */
    it('lifts the clear colour from its stored byte 19 to the displayed 77', () => {
      const encoded = encodeTargetPixels(pixel(19, 19, 19));
      expect([...encoded.data]).toEqual([77, 77, 77, 255]);
    });

    /**
     * The content half of the same claim, and the one a pure-primary fixture
     * could never see. `Color(0.5, 0.5, 0.5)` is sRGB 0.5 → linear 0.214 →
     * byte 55 in the target; Godot draws it at 127. A raw blit would show 55 —
     * a 2.3x error in displayed terms that still looks like a plausible grey.
     */
    it('lifts a mid grey from its stored byte 55 to the displayed 128', () => {
      const encoded = encodeTargetPixels(pixel(55, 55, 55));
      expect([...encoded.data]).toEqual([128, 128, 128, 255]);
    });

    it('leaves both endpoints alone — the encode is the identity at 0 and 255', () => {
      expect([...encodeTargetPixels(pixel(0, 0, 0)).data]).toEqual([0, 0, 0, 255]);
      expect([...encodeTargetPixels(pixel(255, 255, 255)).data]).toEqual([255, 255, 255, 255]);
    });

    /**
     * Alpha is a coverage fraction, not a colour — Godot's own
     * `Color::to_rgba32` encodes it linearly too. A `transparent_bg`
     * sub-viewport clears to alpha 0, and encoding that would make the
     * surface's uncovered region wrongly opaque.
     */
    it('never touches alpha', () => {
      expect([...encodeTargetPixels(pixel(19, 55, 0, 19)).data]).toEqual([77, 128, 0, 19]);
    });

    it('encodes every pixel, not just the first', () => {
      const image = new ImageData(
        new Uint8ClampedArray([0, 0, 0, 255, 19, 19, 19, 255, 55, 55, 55, 255]),
        3,
        1
      );
      expect([...encodeTargetPixels(image).data]).toEqual([
        0, 0, 0, 255, 77, 77, 77, 255, 128, 128, 128, 255,
      ]);
    });

    /**
     * Monotonic and non-shrinking: the encode expands the darks (that is the
     * whole point of storing linear), so no byte may come back smaller than it
     * went in, and ordering must survive.
     */
    it('is monotonic across the whole byte range and never darkens', () => {
      const ramp = new Uint8ClampedArray(256 * 4);
      for (let i = 0; i < 256; i++) {
        ramp[i * 4] = i;
        ramp[i * 4 + 1] = i;
        ramp[i * 4 + 2] = i;
        ramp[i * 4 + 3] = 255;
      }
      const out = encodeTargetPixels(new ImageData(ramp, 256, 1)).data;
      for (let i = 0; i < 256; i++) {
        expect(out[i * 4]).toBeGreaterThanOrEqual(i);
        if (i > 0) expect(out[i * 4]).toBeGreaterThanOrEqual(out[(i - 1) * 4]!);
      }
    });
  });

  describe('edge cases', () => {
    it('handles a zero-pixel image without touching anything', () => {
      const empty = new ImageData(new Uint8ClampedArray(0), 0, 0);
      expect(encodeTargetPixels(empty).data.length).toBe(0);
    });

    /**
     * Mutates in place rather than allocating a third buffer: `readPixels`
     * already allocated the GL buffer and `targetPixelsToImageData` the flipped
     * copy, and this runs on a 766 KB image.
     */
    it('returns the SAME ImageData it was handed', () => {
      const image = pixel(19, 19, 19);
      expect(encodeTargetPixels(image)).toBe(image);
    });
  });
});
