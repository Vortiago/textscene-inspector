/**
 * `<TextRun>` — merged glyph quads at a `shapeText` layout's positions.
 * Assertions are scene-graph structure only (mesh/geometry/material shape),
 * never pixels — the paint itself is a golden-image concern elsewhere.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TextRun, buildGlyphQuadArrays, type TextRunProps } from './TextRun';
import { shapeText, AutowrapMode } from './textLayout';
import { OPEN_SANS_ATLAS_GLYPHS, OPEN_SANS_ATLAS_INFO } from './openSansAtlas';
import { sRGBToLinearRGB } from '../../../../utils/colorSpace';
import { createRuntimeFontMetrics } from './runtimeFontMetrics';

const WHITE = { r: 1, g: 1, b: 1, a: 1 };
const SCALE = 16 / OPEN_SANS_ATLAS_INFO.fontSize;

function layoutFor(text: string, uppercase = false) {
  return shapeText(text, { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, uppercase, lineSpacingPx: 3 });
}

describe('buildGlyphQuadArrays (pure geometry math)', () => {
  it('emits one quad (4 verts) per visible glyph, skipping a zero-size atlas entry like space', () => {
    const arrays = buildGlyphQuadArrays(layoutFor('A B'), 16);
    expect(arrays.positions.length / 3).toBe(2 * 4);
    expect(arrays.indices.length).toBe(2 * 6);
  });

  it("places the first glyph's left edge from its own xoffset, with no left-edge contribution from the previous glyph", () => {
    const arrays = buildGlyphQuadArrays(layoutFor('AB'), 16);
    // Vertex order per quad: TL, TR, BL, BR (x,y,z each) -- TL.x is vertex 0.
    const aLeft = arrays.positions[0]!;
    const bLeft = arrays.positions[4 * 3 + 0]!;
    const a = OPEN_SANS_ATLAS_GLYPHS.A!;
    const b = OPEN_SANS_ATLAS_GLYPHS.B!;
    expect(aLeft).toBeCloseTo(0 + a.xoffset * SCALE, 6);
    // B's pen x is A's advance; B's left edge adds B's own xoffset on top.
    const layout = layoutFor('AB');
    const penB = layout.lines[0]!.glyphs[1]!.x;
    expect(bLeft).toBeCloseTo(penB + b.xoffset * SCALE, 6);
  });

  it('renders the UPPERCASED glyph a layout already transformed to, not the source casing', () => {
    const lower = buildGlyphQuadArrays(layoutFor('a'), 16);
    const upper = buildGlyphQuadArrays(layoutFor('a', true), 16);
    const aGlyph = OPEN_SANS_ATLAS_GLYPHS.a!;
    const AGlyph = OPEN_SANS_ATLAS_GLYPHS.A!;
    const lowerWidth = lower.positions[1 * 3]! - lower.positions[0]!; // TR.x - TL.x
    const upperWidth = upper.positions[1 * 3]! - upper.positions[0]!;
    expect(lowerWidth).toBeCloseTo(aGlyph.width * SCALE, 6);
    expect(upperWidth).toBeCloseTo(AGlyph.width * SCALE, 6);
  });

  it('shears the bitmap by a DIFFERENT amount at its top vs. its bottom edge, proving a real per-vertex shear rather than a uniform per-glyph translation', () => {
    const straight = buildGlyphQuadArrays(layoutFor('A'), 16, 0);
    const skewed = buildGlyphQuadArrays(layoutFor('A'), 16, 0.2);
    // Vertex layout per quad: 0=TL,1=TR,2=BL,3=BR ; x is index*3.
    const topDx = skewed.positions[0]! - straight.positions[0]!;
    const bottomDx = skewed.positions[2 * 3]! - straight.positions[2 * 3]!;
    expect(topDx).not.toBe(0);
    expect(topDx).not.toBeCloseTo(bottomDx, 6);
  });

  it(
    "shears each vertex around the glyph's BASELINE, not the line's top edge — " +
      "FreeType's FT_Outline_Transform (text_server_adv.cpp:1318-1320, :3621-3623) runs on the " +
      "glyph outline loaded by FT_Load_Glyph, whose own coordinate origin is the glyph's baseline pen " +
      "position, so a shear coefficient of 0.2 leaves a vertex ON the baseline unmoved and shifts a " +
      "vertex ABOVE it (an ascender, smaller yPx) to the RIGHT — a pivot at the line's top edge instead " +
      "(0.2 * distance below line top) would shift every ascender-height vertex LEFT, which is the " +
      "wrong direction and (for a run boundary) eats into the space that precedes it.",
    () => {
      // 'A' (fontSize 16, atlas bake size 42, SCALE = 16/42): yoffset=13, height=34,
      // bake `base` = 45. baselineOffsetPx at fontSize 16 = ceil(2189 * 16/2048) = 18.
      // topPx = 18 - (45 - 13)*(16/42) = 5.809523809...; bottomPx = topPx + 34*(16/42)
      // = 18.761904761... — the bitmap's own bottom edge sits a shade BELOW the baseline
      // (the bake's anti-aliasing padding: 13 + 34 - 45 = 2 bake px), not the ~18.8 below
      // the line top a top-edge pivot would use.
      const skewed = buildGlyphQuadArrays(layoutFor('A'), 16, 0.2);
      const straight = buildGlyphQuadArrays(layoutFor('A'), 16, 0);
      const topDx = skewed.positions[0]! - straight.positions[0]!;
      const bottomDx = skewed.positions[2 * 3]! - straight.positions[2 * 3]!;
      // -0.2 * (5.809523809 - 18) = 2.438095238...
      expect(topDx).toBeCloseTo(2.4380952, 5);
      // -0.2 * (18.761904761 - 18) = -0.152380952...
      expect(bottomDx).toBeCloseTo(-0.1523809, 5);
    }
  );

  it(
    "anchors a line at its BASELINE (`layout.baselineOffsetPx` below the line's box top), " +
      'folding the MSDF bake\'s own line-top anchor (`OPEN_SANS_ATLAS_INFO.base` above that ' +
      'baseline) in HERE rather than leaving it for a caller to add back — at fontSize 16 the ' +
      "reconciliation is 18 - 45*(16/42) = 0.857142857... Godot px, and every consumer that used to " +
      'carry it now positions a line by its box-top Y alone.',
    () => {
      const layout = layoutFor('A');
      const a = OPEN_SANS_ATLAS_GLYPHS.A!;
      const arrays = buildGlyphQuadArrays(layout, 16);
      // TL.y is float index 1; geometry Y is negated Godot px.
      const topPx = -arrays.positions[1]!;
      expect(layout.baselineOffsetPx).toBe(18);
      expect(topPx).toBeCloseTo(18 - (OPEN_SANS_ATLAS_INFO.base - a.yoffset) * SCALE, 6);
      // The reconciliation is genuinely nonzero: the bake anchor and the shaped
      // ascent are DIFFERENT quantities, so a painter that ignored one would be
      // wrong by this much on every line.
      expect(OPEN_SANS_ATLAS_INFO.base * SCALE).not.toBeCloseTo(layout.baselineOffsetPx, 3);
      expect(18 - OPEN_SANS_ATLAS_INFO.base * SCALE).toBeCloseTo(0.8571428571428577, 10);
    }
  );

  it('places line N exactly one linePitchPx below line N-1, with the same per-line baseline anchor', () => {
    const layout = shapeText('A\nA', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 3 });
    const arrays = buildGlyphQuadArrays(layout, 16);
    const firstTop = -arrays.positions[1]!;
    const secondTop = -arrays.positions[4 * 3 + 1]!;
    expect(secondTop - firstTop).toBeCloseTo(layout.linePitchPx, 5);
  });
});

async function renderTextRun(props: Partial<TextRunProps> = {}) {
  return ReactThreeTestRenderer.create(
    <TextRun layout={layoutFor('AB')} fontSizePx={16} tint={WHITE} {...props} />
  );
}

describe('<TextRun>', () => {
  it('mounts a single mesh carrying the merged glyph geometry', async () => {
    const renderer = await renderTextRun();
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes).toHaveLength(1);
    const geometry = (meshes[0]!.instance as THREE.Mesh).geometry as THREE.BufferGeometry;
    expect(geometry.getAttribute('position').count).toBe(2 * 4);
  });

  it('tints the material from the sRGB tint, converted to linear, with alpha as opacity', async () => {
    const tint = { r: 0.2, g: 0.4, b: 0.6, a: 0.75 };
    const renderer = await renderTextRun({ tint });
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.ShaderMaterial;
    const [lr, lg, lb] = sRGBToLinearRGB(tint.r, tint.g, tint.b);
    const uColor = mat.uniforms.uColor!.value as THREE.Vector3;
    expect(uColor.x).toBeCloseTo(lr, 6);
    expect(uColor.y).toBeCloseTo(lg, 6);
    expect(uColor.z).toBeCloseTo(lb, 6);
    expect(mat.uniforms.uOpacity!.value).toBe(0.75);
  });

  it('forwards distanceBias to the material', async () => {
    const renderer = await renderTextRun({ distanceBias: 0.1 });
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.ShaderMaterial;
    expect(mat.uniforms.uDistanceBias!.value).toBe(0.1);
  });

  it('forwards clipping planes to the material (per-material state)', async () => {
    const planes = [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)];
    const renderer = await renderTextRun({ clippingPlanes: planes });
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.ShaderMaterial;
    expect(mat.clippingPlanes).toEqual(planes);
  });

  it('renders one fewer quad when the layout has an extra whitespace-only glyph', async () => {
    const renderer = await renderTextRun({ layout: layoutFor('A B') });
    const geometry = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry as THREE.BufferGeometry;
    expect(geometry.getAttribute('position').count).toBe(2 * 4);
  });
});

describe('<TextRun> — internal dispatch to the canvas painter for a "canvas"-kind FontMetrics', () => {
  const CANVAS_METRICS = createRuntimeFontMetrics({
    scalars: { unitsPerEm: 1000, ascent: 800, descent: 200 },
    measureWidthUnits: (text) => text.length * 500,
    cssFontFamily: 'scene-font-textrun-test',
  });

  function canvasLayoutFor(text: string) {
    return shapeText(text, {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.OFF,
      fontMetrics: CANVAS_METRICS,
      lineSpacingPx: 3,
    });
  }

  it('mounts a single mesh with EXACTLY ONE quad (4 verts), unlike the per-glyph atlas path', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TextRun layout={canvasLayoutFor('Hello')} fontSizePx={16} tint={WHITE} />
    );
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes).toHaveLength(1);
    const geometry = (meshes[0]!.instance as THREE.Mesh).geometry as THREE.BufferGeometry;
    expect(geometry.getAttribute('position').count).toBe(4);
    expect(geometry.getIndex()!.count).toBe(6);
  });

  it('uses a plain textured material (no MSDF uniforms/shader), sourced from a canvas texture', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TextRun layout={canvasLayoutFor('Hi')} fontSizePx={16} tint={WHITE} />
    );
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect((mat as unknown as { isShaderMaterial?: boolean }).isShaderMaterial).toBeUndefined();
    expect(mat.map).toBeInstanceOf(THREE.CanvasTexture);
    expect(mat.transparent).toBe(true);
  });

  it('applies tint.a directly as material opacity (the canvas raster is drawn opaque; alpha is not baked into it)', async () => {
    const tint = { r: 1, g: 1, b: 1, a: 0.4 };
    const renderer = await ReactThreeTestRenderer.create(
      <TextRun layout={canvasLayoutFor('Hi')} fontSizePx={16} tint={tint} />
    );
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(mat.opacity).toBe(0.4);
  });

  it('forwards clippingPlanes/depthTest/side to the canvas material, same contract as the MSDF path', async () => {
    const planes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)];
    const renderer = await ReactThreeTestRenderer.create(
      <TextRun
        layout={canvasLayoutFor('Hi')}
        fontSizePx={16}
        tint={WHITE}
        clippingPlanes={planes}
        depthTest
        side={THREE.FrontSide}
      />
    );
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(mat.clippingPlanes).toEqual(planes);
    expect(mat.depthTest).toBe(true);
    expect(mat.side).toBe(THREE.FrontSide);
  });

  it('a layout shaped against the DEFAULT (atlas) metrics still takes the MSDF path — dispatch is per-layout, not global', async () => {
    const renderer = await renderTextRun(); // uses layoutFor('AB'), the default OPEN_SANS_FONT_METRICS
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.ShaderMaterial;
    expect(mat.isShaderMaterial).toBe(true);
    expect(mat.uniforms.uMap).toBeDefined();
  });
});
