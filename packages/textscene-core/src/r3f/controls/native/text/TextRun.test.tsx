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
      // 'A' (fontSize 16, atlas bake size 42, SCALE = 16/42): yoffset=12.8916015625,
      // height=34, bake `base` = 44.8916015625 (both floats — `roundDecimal: null`
      // leaves the bake tool's own unrounded numbers, but `base - yoffset` is an
      // integer 32 either way, since both carry the SAME baseline offset).
      // baselineOffsetPx at fontSize 16 = ceil(2189 * 16/2048) = 18.
      // topPx = 18 - (44.8916015625 - 12.8916015625)*(16/42) = 5.809523809...;
      // bottomPx = topPx + 34*(16/42) = 18.761904761... — the bitmap's own bottom
      // edge sits a shade BELOW the baseline (the bake's anti-aliasing padding:
      // 12.8916015625 + 34 - 44.8916015625 = 2 bake px), not the ~18.8 below the
      // line top a top-edge pivot would use.
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
      'reconciliation is 18 - OPEN_SANS_ATLAS_INFO.base*(16/42) Godot px, and every consumer ' +
      'that used to carry it now positions a line by its box-top Y alone.',
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
      // `OPEN_SANS_ATLAS_INFO.base` is msdf-bmfont-xml's own `baseline`
      // (`index.js:346`): `os2.sTypoAscender * (fontSize / unitsPerEm)`, ATLAS
      // fontSize = 42 here. For OpenSans_SemiBold, OS/2 `sTypoAscender` (2189)
      // equals the hhea `ascent` `OPEN_SANS_METRICS.ascent` bakes separately —
      // so `base * (16/42)` reduces to `2189 * (16/2048)` regardless of the
      // atlas's own bake size, and the reconciliation below is really just
      // Godot's ceiling rule's own discarded remainder
      // (`getFontAscentPx`/`text_server_adv.cpp:1515-1516`): `ceil(2189*16/2048)
      // - 2189*16/2048 = 18 - 17.1015625 = 0.8984375`. It is unrounded (`bake-
      // metrics.mjs` bakes `roundDecimal: null`) but bake-size-independent
      // either way — the fix changed `base`'s exact float (was 45 pre-fix,
      // the whole-bake-pixel round of 44.8916015625) without changing which
      // constants this reconciliation is actually built from.
      expect(OPEN_SANS_ATLAS_INFO.base * (2048 / 42)).toBe(2189);
      expect(18 - OPEN_SANS_ATLAS_INFO.base * SCALE).toBeCloseTo(0.8984375, 10);
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

  it(
    'tags the canvas raster SRGBColorSpace -- DELIBERATELY NOT the general 2D-canvas ' +
      '`NoColorSpace` rule (`canvas2DTextureDecode.ts`) every OTHER 2D-canvas-drawn texture ' +
      '(TextureRect, theme icons, sprites) gets. Measured, not inferred ' +
      '(`unit-control-scene-font-magnified.tscn`\'s header has the arbitration): `NoColorSpace` ' +
      'here produces a dip below the backdrop at a magnified glyph edge that Godot\'s own render ' +
      'of the SAME scene never shows, because Godot\'s own glyph texture is a coverage mask with ' +
      'a CONSTANT colour channel (`text_server_adv.cpp` `rasterize_bitmap`, `FT_PIXEL_MODE_GRAY`: ' +
      '`wr[ofs+0] = 255` always, only `wr[ofs+1]` -- alpha, never sRGB-encoded -- varies), so the ' +
      'byte-vs-decoded-first blend order this file\'s sibling fixes correct for icons/sprites is, ' +
      'for Godot\'s OWN text rendering, never even in play. `TextRun.tsx`\'s own doc has the full ' +
      'derivation. This pins the decision against a future change that "completes the pattern" by ' +
      'copying the icon/sprite retag here without re-measuring.',
    async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <TextRun layout={canvasLayoutFor('Hi')} fontSizePx={16} tint={WHITE} />
      );
      const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
      expect(mat.map!.colorSpace).toBe(THREE.SRGBColorSpace);
    }
  );

  it(
    'leaves DECODE_VIDEO_TEXTURE UNSET, matching the kept SRGBColorSpace tag -- ' +
      '`createCanvasTextMaterial`\'s own auto-detection (`map.colorSpace === NoColorSpace`) means ' +
      'this follows automatically from the tag above rather than needing its own separate pin, but ' +
      'asserted here anyway: a `SRGBColorSpace` texture ALREADY gets three\'s automatic hardware ' +
      'decode, so also setting this define would decode the sample TWICE.',
    async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <TextRun layout={canvasLayoutFor('Hi')} fontSizePx={16} tint={WHITE} />
      );
      const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
      expect(mat.defines?.DECODE_VIDEO_TEXTURE).toBeUndefined();
    }
  );

  it(
    'keeps the SRGBColorSpace tag across a re-render that reuses the SAME material -- the ' +
      'material is built imperatively (`createCanvasTextMaterial`, a plain ' +
      '`new THREE.MeshBasicMaterial(...)`), never through a JSX `<meshBasicMaterial map={...}>` ' +
      'element, so `@react-three/fiber`\'s `applyProps` `colorMaps` re-tagging never gets a chance ' +
      'to run on it either way -- proving the KEPT tag survives a second commit the same way a ' +
      'retag would have (`undecodedTexture.ts`\'s own doc: that re-tagging is what forces ' +
      '`useIconTexture` to use `pinNoColorSpace` instead of a plain assignment there). ' +
      '`renderOrder` is deliberately NOT a `useMemo` dep (`TextRun.tsx`\'s own deps list), so ' +
      'changing only it forces a second commit of the SAME material/texture object.',
    async () => {
      // SAME layout object reference across both renders -- `layout` is a
      // `useMemo` dep, so calling `canvasLayoutFor('Hi')` a second time (a
      // fresh object, equal contents but different identity) would rebuild
      // the material for that reason alone, defeating the point of this test.
      const layout = canvasLayoutFor('Hi');
      const renderer = await ReactThreeTestRenderer.create(
        <TextRun layout={layout} fontSizePx={16} tint={WHITE} renderOrder={0} />
      );
      const mesh1 = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
      const mat = mesh1.material as THREE.MeshBasicMaterial;
      expect(mat.map!.colorSpace).toBe(THREE.SRGBColorSpace);
      await renderer.update(<TextRun layout={layout} fontSizePx={16} tint={WHITE} renderOrder={5} />);
      const mesh2 = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
      const matAfter = mesh2.material as THREE.MeshBasicMaterial;
      expect(matAfter).toBe(mat); // same object -- proves the memo held and this is a genuine re-commit, not a rebuild
      expect(mesh2.renderOrder).toBe(5); // proves the second commit actually applied props
      expect(matAfter.map!.colorSpace).toBe(THREE.SRGBColorSpace);
    }
  );

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
