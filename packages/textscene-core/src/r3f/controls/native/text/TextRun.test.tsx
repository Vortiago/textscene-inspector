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

const WHITE = { r: 1, g: 1, b: 1, a: 1 };
const SCALE = 16 / OPEN_SANS_ATLAS_INFO.fontSize;

function layoutFor(text: string, uppercase = false) {
  return shapeText(text, { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, uppercase });
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
    const geometry = meshes[0]!.instance.geometry as THREE.BufferGeometry;
    expect(geometry.getAttribute('position').count).toBe(2 * 4);
  });

  it('tints the material from the sRGB tint, converted to linear, with alpha as opacity', async () => {
    const tint = { r: 0.2, g: 0.4, b: 0.6, a: 0.75 };
    const renderer = await renderTextRun({ tint });
    const mat = renderer.scene.findByType('Mesh').instance.material as THREE.ShaderMaterial;
    const [lr, lg, lb] = sRGBToLinearRGB(tint.r, tint.g, tint.b);
    const uColor = mat.uniforms.uColor!.value as THREE.Vector3;
    expect(uColor.x).toBeCloseTo(lr, 6);
    expect(uColor.y).toBeCloseTo(lg, 6);
    expect(uColor.z).toBeCloseTo(lb, 6);
    expect(mat.uniforms.uOpacity!.value).toBe(0.75);
  });

  it('forwards distanceBias to the material', async () => {
    const renderer = await renderTextRun({ distanceBias: 0.1 });
    const mat = renderer.scene.findByType('Mesh').instance.material as THREE.ShaderMaterial;
    expect(mat.uniforms.uDistanceBias!.value).toBe(0.1);
  });

  it('forwards clipping planes to the material (per-material state)', async () => {
    const planes = [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)];
    const renderer = await renderTextRun({ clippingPlanes: planes });
    const mat = renderer.scene.findByType('Mesh').instance.material as THREE.ShaderMaterial;
    expect(mat.clippingPlanes).toEqual(planes);
  });

  it('renders one fewer quad when the layout has an extra whitespace-only glyph', async () => {
    const renderer = await renderTextRun({ layout: layoutFor('A B') });
    const geometry = renderer.scene.findByType('Mesh').instance.geometry as THREE.BufferGeometry;
    expect(geometry.getAttribute('position').count).toBe(2 * 4);
  });
});
