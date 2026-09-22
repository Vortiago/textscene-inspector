import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  computeCanvasTextCanvasLayout,
  buildCanvasTextQuadArrays,
  createCanvasTextMaterial,
  CANVAS_TEXT_SUPERSAMPLE,
} from './canvasTextPainter';
import { shapeText, AutowrapMode } from './textLayout';
import { createRuntimeFontMetrics } from './runtimeFontMetrics';

const CANVAS_METRICS = createRuntimeFontMetrics({
  scalars: { unitsPerEm: 1000, ascent: 800, descent: 200 },
  measureWidthUnits: (text) => text.length * 500,
  cssFontFamily: 'scene-font-test',
});

function layoutFor(text: string, lineSpacingPx = 3) {
  return shapeText(text, {
    fontSizePx: 16,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.OFF,
    fontMetrics: CANVAS_METRICS,
    lineSpacingPx,
  });
}

/**
 * Where the raster pixel the painter draws content-box x=0 (resp. y=0) into
 * actually lands in the quad's own coordinate space — the painter draws at
 * CSS `offsetXPx`/`offsetYPx` on a canvas sized ``deviceWidthPx` x
 * `deviceHeightPx` device px, and the quad samples that whole canvas across
 * its own extent.
 */
function contentOriginOnQuad(
  canvasLayout: ReturnType<typeof computeCanvasTextCanvasLayout>
): { x: number; y: number } {
  const { positions } = buildCanvasTextQuadArrays(canvasLayout);
  const [left, top] = [positions[0]!, positions[1]!];
  const [right, bottom] = [positions[3]!, positions[7]!];
  const { deviceWidthPx: deviceW, deviceHeightPx: deviceH } = canvasLayout;
  const col = canvasLayout.offsetXPx * CANVAS_TEXT_SUPERSAMPLE;
  const row = canvasLayout.offsetYPx * CANVAS_TEXT_SUPERSAMPLE;
  return {
    x: left + (col / deviceW) * (right - left),
    // Quad Y is negated Godot Y (`buildCanvasTextQuadArrays`), so the
    // content-box top is the LARGEST y.
    y: -(top + (row / deviceH) * (bottom - top)),
  };
}

describe('computeCanvasTextCanvasLayout', () => {
  it('with no skew, pads only for anti-aliasing overshoot: canvas content area equals the layout box', () => {
    const layout = layoutFor('AB');
    const canvasLayout = computeCanvasTextCanvasLayout(layout, 0);
    expect(canvasLayout.canvasWidthPx).toBeCloseTo(layout.widthPx, 6);
    expect(canvasLayout.offsetXPx).toBe(0);
  });

  it('a nonzero skew widens the canvas symmetrically to fit the sheared ink, and offsets content by the same pad', () => {
    const layout = layoutFor('AB');
    const straight = computeCanvasTextCanvasLayout(layout, 0);
    const skewed = computeCanvasTextCanvasLayout(layout, 0.3);
    expect(skewed.canvasWidthPx).toBeGreaterThan(straight.canvasWidthPx);
    expect(skewed.offsetXPx).toBeGreaterThan(0);
    // Symmetric: padding added equally left/right.
    expect(skewed.canvasWidthPx - layout.widthPx).toBeCloseTo(2 * skewed.offsetXPx, 6);
  });

  it('canvas height always exceeds the layout height by the same fixed vertical pad, independent of skew', () => {
    const layout = layoutFor('AB');
    const straight = computeCanvasTextCanvasLayout(layout, 0);
    const skewed = computeCanvasTextCanvasLayout(layout, 0.5);
    expect(straight.canvasHeightPx).toBeGreaterThan(layout.heightPx);
    expect(straight.canvasHeightPx).toBe(skewed.canvasHeightPx);
  });
});

describe('the outline surface overlays the fill surface exactly', () => {
  // Label3D draws two surfaces from one layout — a stroked outline
  // (`label_3d.cpp:610-615`) and the fill — and they must line up
  // glyph-for-glyph despite the outline's own stroke padding. Fractional
  // line spacing makes the UNSTROKED surface fractional too, so neither side
  // gets to be accidentally whole-pixel.
  const layout = layoutFor('AB', 0.5);
  const stroked = computeCanvasTextCanvasLayout(layout, 0, 1.5);
  const filled = computeCanvasTextCanvasLayout(layout, 0, 0);

  it('puts the content-box origin at the same place on a stroked and an unstroked quad', () => {
    const a = contentOriginOnQuad(stroked);
    const b = contentOriginOnQuad(filled);
    expect(a.x).toBeCloseTo(b.x, 6);
    expect(a.y).toBeCloseTo(b.y, 6);
  });

  it('puts it exactly at the quad origin, so neighbouring runs laid out against layout.widthPx line up', () => {
    for (const canvasLayout of [stroked, filled]) {
      const origin = contentOriginOnQuad(canvasLayout);
      expect(origin.x).toBeCloseTo(0, 6);
      expect(origin.y).toBeCloseTo(0, 6);
    }
  });
});

describe('buildCanvasTextQuadArrays', () => {
  it('emits exactly one quad (4 verts, 6 indices) regardless of glyph count', () => {
    const layout = layoutFor('Hello World');
    const canvasLayout = computeCanvasTextCanvasLayout(layout, 0);
    const arrays = buildCanvasTextQuadArrays(canvasLayout);
    expect(arrays.positions.length).toBe(4 * 3);
    expect(arrays.uvs.length).toBe(4 * 2);
    expect(arrays.indices.length).toBe(6);
  });

  it('the quad spans exactly the PADDED canvas box, in Godot px (+Y down) negated to three-local Y-up, offset so the UNPADDED content still starts at local x=0', () => {
    const layout = layoutFor('AB');
    const canvasLayout = computeCanvasTextCanvasLayout(layout, 0.3);
    const arrays = buildCanvasTextQuadArrays(canvasLayout);
    // Vertex order TL, TR, BL, BR (matches buildGlyphQuadArrays's own convention).
    const tlX = arrays.positions[0]!;
    const tlY = arrays.positions[1]!;
    const trX = arrays.positions[3]!;
    const blY = arrays.positions[2 * 3 + 1]!;
    expect(tlX).toBeCloseTo(-canvasLayout.offsetXPx, 6);
    expect(trX).toBeCloseTo(layout.widthPx + canvasLayout.offsetXPx, 6);
    // Y is negated (three-local Y-up); top edge y = -(-offsetYPx) = offsetYPx (above the content box).
    expect(tlY).toBeCloseTo(canvasLayout.offsetYPx, 6);
    expect(blY).toBeCloseTo(-(canvasLayout.canvasHeightPx - canvasLayout.offsetYPx), 6);
  });

  it('UVs cover the full [0,1] texture with flipY convention (top edge v=1)', () => {
    const layout = layoutFor('AB');
    const canvasLayout = computeCanvasTextCanvasLayout(layout, 0);
    const arrays = buildCanvasTextQuadArrays(canvasLayout);
    // TL uv
    expect(arrays.uvs[0]).toBe(0);
    expect(arrays.uvs[1]).toBe(1);
    // BR uv
    expect(arrays.uvs[3 * 2]).toBe(1);
    expect(arrays.uvs[3 * 2 + 1]).toBe(0);
  });
});

describe('createCanvasTextMaterial', () => {
  it('is transparent, depth-write disabled, samples the given texture, and applies opacity directly (tint is pre-baked into the raster, unlike the MSDF uColor uniform)', () => {
    const texture = new THREE.CanvasTexture(document.createElement('canvas'));
    const mat = createCanvasTextMaterial({ map: texture, opacity: 0.5 });
    expect(mat.transparent).toBe(true);
    expect(mat.depthWrite).toBe(false);
    expect(mat.map).toBe(texture);
    expect(mat.opacity).toBe(0.5);
  });

  it('forwards depthTest/side/clippingPlanes, matching createMsdfMaterial’s own contract', () => {
    const texture = new THREE.CanvasTexture(document.createElement('canvas'));
    const planes = [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)];
    const mat = createCanvasTextMaterial({
      map: texture,
      opacity: 1,
      depthTest: true,
      side: THREE.FrontSide,
      clippingPlanes: planes,
    });
    expect(mat.depthTest).toBe(true);
    expect(mat.side).toBe(THREE.FrontSide);
    expect(mat.clippingPlanes).toEqual(planes);
  });

  it(
    "sets the DECODE_VIDEO_TEXTURE define when `map` is tagged NoColorSpace -- Godot's 2D canvas " +
      'blends the ENCODED bytes of every texture it samples (`rendering/viewport/hdr_2d` default ' +
      'false, `rendering_server.cpp:3771`, `texture_storage.cpp:754`), and TextRun.tsx tags this ' +
      'raster NoColorSpace so WebGL uploads it plain instead of hardware-decoding each texel BEFORE ' +
      "the magnification filter runs -- this define moves that decode to AFTER the filter, matching.",
    () => {
      const texture = new THREE.CanvasTexture(document.createElement('canvas'));
      texture.colorSpace = THREE.NoColorSpace;
      const mat = createCanvasTextMaterial({ map: texture, opacity: 1 });
      expect(mat.defines?.DECODE_VIDEO_TEXTURE).toBe('');
    }
  );

  it(
    'leaves `defines` unset for a `map` NOT tagged NoColorSpace, so a caller that ever passes an ' +
      'already-linear map (a SubViewport render target, say) is not double-decoded -- the same ' +
      'auto-detection `useCanvasDecodeDefines`/`ControlQuad` already apply to every other ' +
      '2D-canvas-drawn `map`.',
    () => {
      const texture = new THREE.CanvasTexture(document.createElement('canvas'));
      texture.colorSpace = THREE.SRGBColorSpace;
      const mat = createCanvasTextMaterial({ map: texture, opacity: 1 });
      expect(mat.defines).toBeUndefined();
    }
  );
});
