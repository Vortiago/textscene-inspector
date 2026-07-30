/**
 * The pure rules behind painting a sub-viewport's render target into the DOM
 * surface — the colour conversion and the attempt schedule — kept out of
 * `Component.tsx` so both are asserted directly rather than inferred from a
 * rendered frame.
 *
 * The blit exists because a sub-viewport holding 2D-world or 3D content has no
 * DOM form at all: `ViewportTextureEntry.readPixels` snapshots the target into
 * CPU pixels and the surface draws them into a `<canvas>` (ADR-0030). WebGL
 * consumers sample `entry.texture` instead and never come through here.
 */

/**
 * Linear → sRGB, byte in, byte out, precomputed for all 256 inputs.
 *
 * The target is not display-ready, and that is deliberate:
 * `createOffscreenTarget` tags it `LinearSRGBColorSpace` and sets
 * `isXRRenderTarget`, which is what makes three take the offscreen pass's
 * output space from that tag — so the pass tonemaps exactly as the main pass
 * does and then writes WORKING-space values with no transfer function. A 2D
 * canvas does the opposite: `putImageData` bytes are interpreted as sRGB, and
 * the context applies no conversion of its own. The OETF is the one step
 * between them, and skipping it darkens everything by the whole sRGB curve —
 * the same class of error the offscreen pass's own `isXRRenderTarget` comment
 * documents from the other direction.
 *
 * The main WebGL canvas gets this encode for free: three applies it in the
 * fragment shader when rendering to the default framebuffer, whose
 * `outputColorSpace` is sRGB. The blit is a second consumer of the same target
 * that bypasses that shader, so it has to do the same work on the CPU.
 *
 * Two calibration points, both measured through Godot 4.6.3 rather than
 * derived (`scenes/fixtures/unit-sub-viewport-container-2d-content.tscn`):
 *
 *   stored 19  → 77   the default clear colour, sRGB Color(0.3, 0.3, 0.3);
 *                     Godot renders 76, and `SubViewportContainer` already
 *                     paints rgb(77, 77, 77) for the DOM arm of the same rect
 *   stored 55  → 128  authored Color(0.5, 0.5, 0.5); Godot renders 127
 *
 * The 1-byte gap either way is the cost of an 8-bit LINEAR intermediate: Godot
 * keeps float precision all the way to its swap chain, while the target
 * quantises before the curve expands the darks. It is the reason the encode is
 * a lookup rather than a per-pixel `Math.pow` — there are only 256 possible
 * inputs, so the table is exact for every value the target can hold.
 *
 * The transfer function is IEC 61966-2-1's, the same piecewise curve three's
 * `ColorManagement` uses.
 */
const SRGB_ENCODE = /* @__PURE__ */ (() => {
  const table = new Uint8ClampedArray(256);
  for (let byte = 0; byte < 256; byte++) {
    const linear = byte / 255;
    const encoded =
      linear <= 0.0031308 ? linear * 12.92 : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
    table[byte] = Math.round(encoded * 255);
  }
  return table;
})();

/**
 * Encode a target snapshot for display, in place.
 *
 * Alpha is left alone — it is a coverage fraction, not a colour, and Godot's
 * own `Color::to_rgba32` quantises it without a curve. A `transparent_bg`
 * sub-viewport clears to alpha 0, which must stay 0 so the surface's uncovered
 * region really is see-through.
 *
 * In place rather than allocating: `readPixels` already allocated the GL
 * buffer and `targetPixelsToImageData` the row-flipped copy, and this runs on
 * up to a megabyte per attempt.
 */
export function encodeTargetPixels(image: ImageData): ImageData {
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    // Channel loop rather than three unrolled reads: `noUncheckedIndexedAccess`
    // types every typed-array read as possibly undefined, so this is one
    // guarded read instead of three. Both fallbacks are unreachable — the
    // table covers all 256 byte values — and both are the identity, so a
    // hypothetical miss would pass the byte through rather than blacken it.
    for (let channel = 0; channel < 3; channel++) {
      const stored = data[i + channel] ?? 0;
      data[i + channel] = SRGB_ENCODE[stored] ?? stored;
    }
  }
  return image;
}

/**
 * How long the surface keeps re-reading the target, in ms between attempts.
 *
 * `readRenderTargetPixels` is a synchronous GPU stall, so a per-frame readback
 * would trade a static previewer's whole frame budget for content that stops
 * changing after load. Instead the surface samples on a bounded schedule and
 * then stops for good.
 *
 * The cadence and the count are the visual harness's own settle contract
 * (`scripts/visual/previewServer.mjs`: `SETTLE_INTERVAL_MS` 350, and an outer
 * bound of `SETTLE_INITIAL_MS` + `SETTLE_MAX_ATTEMPTS` × interval = 5400 ms),
 * which is the repo's measured answer to "a whole game world has finished
 * rasterising" — exactly the question the last useful blit is asking.
 * `BLIT_ATTEMPTS` × the interval clears that bound.
 */
export const BLIT_INTERVAL_MS = 350;

/** Attempts after the opening animation frame; 16 × 350 ms = 5600 ms. */
export const BLIT_ATTEMPTS = 16;
