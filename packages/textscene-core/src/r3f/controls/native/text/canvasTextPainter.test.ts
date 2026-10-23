import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  computeCanvasTextCanvasLayout,
  buildCanvasTextQuadArrays,
  createCanvasTextMaterial,
  paintSceneFontCanvas,
} from './canvasTextPainter';
import { shapeText } from './textLayout';
import { createRuntimeFontMetrics } from './runtimeFontMetrics';
import { patchedFragment } from '../../../testing/patchedFragment';
import { mipmappedTexture } from '../../../testing/mipmapBiasUniform';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';

const CANVAS_METRICS = createRuntimeFontMetrics({
  scalars: { unitsPerEm: 1000, ascent: 800, descent: 200 },
  measureWidthUnits: (text) => text.length * 500,
  cssFontFamily: 'scene-font-test',
});

function layoutFor(text: string, lineSpacingPx = 3) {
  return shapeText(text, {
    fontSizePx: 16,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    fontMetrics: CANVAS_METRICS,
    lineSpacingPx,
  });
}

/**
 * Where the raster pixel for content-box x=0 (or y=0) lands in the quad's space:
 * the painter draws at `offsetXPx`/`offsetYPx` on a `canvasWidthPx` x
 * `canvasHeightPx` canvas, and the quad samples that whole canvas.
 */
function contentOriginOnQuad(canvasLayout: ReturnType<typeof computeCanvasTextCanvasLayout>): {
  x: number;
  y: number;
} {
  const { positions } = buildCanvasTextQuadArrays(canvasLayout);
  const [left, top] = [positions[0]!, positions[1]!];
  const [right, bottom] = [positions[3]!, positions[7]!];
  const { canvasWidthPx, canvasHeightPx, offsetXPx, offsetYPx } = canvasLayout;
  return {
    x: left + (offsetXPx / canvasWidthPx) * (right - left),
    // Quad Y is negated Godot Y (`buildCanvasTextQuadArrays`), so the
    // content-box top is the largest y.
    y: -(top + (offsetYPx / canvasHeightPx) * (bottom - top)),
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

function boldLayoutFor(text: string, embolden: number) {
  return shapeText(text, {
    fontSizePx: 16,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    fontMetrics: CANVAS_METRICS,
    lineSpacingPx: 0,
    emboldenAt: () => embolden,
  });
}

// `FT_Outline_Embolden` grows the outline by `embolden * size / 16` px and anchors it at the left
// and bottom (`text_server_adv.cpp:1313-1314`): half the growth on each side, then a shift of half.
describe('embolden padding', () => {
  it('pads the raster by the outline growth on every side, so the grown ink stays inside it', () => {
    const plain = computeCanvasTextCanvasLayout(layoutFor('AB', 0), 0);
    const bold = computeCanvasTextCanvasLayout(boldLayoutFor('AB', 1.2), 0);
    const growthPx = (1.2 * 16) / 16;
    expect(bold.offsetXPx).toBeCloseTo(plain.offsetXPx + growthPx, 10);
    expect(bold.offsetYPx).toBeCloseTo(plain.offsetYPx + growthPx, 10);
  });

  it('pads by the largest growth when two glyphs differ', () => {
    const layout = layoutFor('AB', 0);
    layout.lines[0]!.glyphs[1]!.emboldenGrowthPx = 2;
    expect(computeCanvasTextCanvasLayout(layout, 0).offsetXPx).toBeCloseTo(2, 10);
  });
});

describe('paintSceneFontCanvas — embolden', () => {
  afterEach(() => vi.restoreAllMocks());

  /** Records the fill and stroke calls of one paint, since happy-dom has no 2D context. */
  function paintRecording(layout: ReturnType<typeof layoutFor>) {
    const calls: { op: string; args: unknown[]; lineWidth: number }[] = [];
    const ctx = {
      lineWidth: 1,
      save: () => {},
      restore: () => {},
      transform: () => {},
      fillText: (...args: unknown[]) => calls.push({ op: 'fillText', args, lineWidth: ctx.lineWidth }),
      strokeText: (...args: unknown[]) => calls.push({ op: 'strokeText', args, lineWidth: ctx.lineWidth }),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
    const canvasLayout = computeCanvasTextCanvasLayout(layout, 0);
    paintSceneFontCanvas(layout, 16, { r: 1, g: 1, b: 1, a: 1 }, 0, canvasLayout);
    return { calls, canvasLayout };
  }

  it('draws a plain glyph with one fill and no stroke', () => {
    const { calls } = paintRecording(layoutFor('A', 0));
    expect(calls.map((c) => c.op)).toEqual(['fillText']);
  });

  it('draws a bold glyph filled and stroked by the growth, shifted right and up by half of it', () => {
    const layout = boldLayoutFor('A', 1.2);
    const { calls, canvasLayout } = paintRecording(layout);
    const growthPx = 1.2;
    const baselineY = canvasLayout.offsetYPx + layout.baselineOffsetPx;
    const expectedArgs = ['A', canvasLayout.offsetXPx + growthPx / 2, baselineY - growthPx / 2];
    expect(calls.map((c) => c.op)).toEqual(['fillText', 'strokeText']);
    expect(calls[0]!.args).toEqual(expectedArgs);
    expect(calls[1]!.args).toEqual(expectedArgs);
    expect(calls[1]!.lineWidth).toBeCloseTo(growthPx, 10);
  });
});

describe('the outline surface overlays the fill surface exactly', () => {
  // Label3D draws a stroked outline (`label_3d.cpp:610-615`) and the fill from one
  // layout, and they line up despite the stroke padding. Fractional line spacing
  // keeps both surfaces off whole pixels.
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
    // Vertex order TL, TR, BL, BR, as in buildGlyphQuadArrays.
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

describe('createCanvasTextMaterial mipmapped', () => {
  it('samples a mipmapped raster at the viewport mipmap bias', () => {
    const material = createCanvasTextMaterial({ map: mipmappedTexture(), opacity: 1, mipmapped: true });

    expect(patchedFragment(material)).toContain('godotMipmapBiased( map,');
  });

  it('leaves a raster with no mip chain as three samples it', () => {
    const material = createCanvasTextMaterial({ map: mipmappedTexture(), opacity: 1 });

    expect(patchedFragment(material)).not.toContain('godotMipmapBias');
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
    "sets the sRGB-multiply define when `map` is tagged NoColorSpace: Godot's 2D canvas filters " +
      'and multiplies the encoded bytes of every texture it samples (`rendering/viewport/hdr_2d` ' +
      'default false, `rendering_server.cpp:3771`, `texture_storage.cpp:754`), and the define ' +
      'decodes the product after the filter and the multiply.',
    () => {
      const texture = new THREE.CanvasTexture(document.createElement('canvas'));
      texture.colorSpace = THREE.NoColorSpace;
      const mat = createCanvasTextMaterial({ map: texture, opacity: 1 });
      expect(mat.defines?.CANVAS_SRGB_MULTIPLY).toBe('');
    }
  );

  it(
    'leaves `defines` unset for a `map` NOT tagged NoColorSpace, so a caller that ever passes an ' +
      'already-linear map (a SubViewport render target, say) is not double-decoded -- the same ' +
      'auto-detection `useCanvasSrgbDefines`/`ControlQuad` already apply to every other ' +
      '2D-canvas-drawn `map`.',
    () => {
      const texture = new THREE.CanvasTexture(document.createElement('canvas'));
      texture.colorSpace = THREE.SRGBColorSpace;
      const mat = createCanvasTextMaterial({ map: texture, opacity: 1 });
      expect(mat.defines).toBeUndefined();
    }
  );
});
