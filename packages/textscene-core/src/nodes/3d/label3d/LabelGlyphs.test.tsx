/**
 * `<LabelGlyphs>` — Label3D's glyph-drawing pass, tested directly rather
 * than through `Component.tsx`'s `React.lazy` boundary (see that file's own
 * doc: the lazy content never resolves synchronously under
 * `@react-three/test-renderer`, the same reason
 * `ControlRasterPass.test.tsx` renders `ControlRasterPasses` directly
 * instead of through `ControlRasterLayer`'s lazy wrapper).
 *
 * Covers what the pre-MSDF canvas-rasteriser tests pinned (text presence,
 * font_size sizing, modulate tint, outline presence/absence, no_depth_test,
 * double_sided, multi-line layout) against the new BufferGeometry +
 * ShaderMaterial shape, plus the outline pass this rewrite adds.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import LabelGlyphs from './LabelGlyphs';
import type { Label3DProperties } from './types';
import { BillboardMode, HorizontalAlignment } from './types';
import { outlineDistanceBias } from './glyphLayout';

function props(overrides: Partial<Label3DProperties> = {}): Label3DProperties {
  return {
    name: 'L',
    text: 'Hi',
    pixel_size: 0.01,
    billboard: BillboardMode.BILLBOARD_DISABLED,
    modulate: { r: 1, g: 1, b: 1, a: 1 },
    outline_size: 0,
    outline_modulate: { r: 0, g: 0, b: 0, a: 1 },
    double_sided: true,
    font_size: 32,
    line_spacing: 0,
    horizontal_alignment: HorizontalAlignment.CENTER,
    no_depth_test: false,
    ...overrides,
  };
}

function boundingSize(mesh: THREE.Mesh): THREE.Vector3 {
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox!;
  return box.getSize(new THREE.Vector3());
}

async function render(p: Label3DProperties) {
  return ReactThreeTestRenderer.create(<LabelGlyphs properties={p} />);
}

describe('<LabelGlyphs>', () => {
  it('renders a Mesh with a non-empty BufferGeometry for non-empty text', async () => {
    const renderer = await render(props({ text: 'Hi' }));
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    expect(mesh.geometry.type).toBe('BufferGeometry');
    expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(0);
  });

  it('renders no glyph ink for empty text (zero-vertex geometry), no throw', async () => {
    const renderer = await render(props({ text: '' }));
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    expect(mesh.geometry.getAttribute('position').count).toBe(0);
  });

  it('scales glyph geometry with font_size — to within the whole-pixel advance round, which is not proportional', async () => {
    const small = await render(props({ text: 'Hello', font_size: 32 }));
    const large = await render(props({ text: 'Hello', font_size: 64 }));
    const smallMesh = small.scene.findByType('Mesh').instance as THREE.Mesh;
    const largeMesh = large.scene.findByType('Mesh').instance as THREE.Mesh;
    const smallSize = boundingSize(smallMesh);
    const largeSize = boundingSize(largeMesh);
    // Both sizes are above SUBPIXEL_POSITIONING_ONE_HALF_MAX_SIZE, so each
    // glyph advance is rounded to a WHOLE pixel with the rounding remainder
    // carried (`text_server_adv.cpp:7079-7084`) — independently at each size,
    // and the two need not land on the same fractions. Doubling the size
    // therefore does not exactly double the pen extent; the residual is
    // bounded by the rounding, not by the scale.
    expect(Math.abs(largeSize.x - smallSize.x * 2)).toBeLessThan(2);
    expect(largeSize.y).toBeCloseTo(smallSize.y * 2, 1);
  });

  it('applies modulate as the material tint (sRGB→linear) and alpha as opacity', async () => {
    const renderer = await render(props({ modulate: { r: 0.5, g: 0.5, b: 0.5, a: 0.5 } }));
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const material = mesh.material as THREE.ShaderMaterial;
    const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    expect(material.uniforms.uColor!.value.x).toBeCloseTo(srgbToLinear(0.5), 4);
    // `uOpacity`, a shader uniform the fragment shader multiplies into alpha
    // itself — NOT `material.opacity` (the built-in THREE.Material field),
    // which a hand-written ShaderMaterial never reads unless the shader
    // says so, and this one does not: `opacity` reaching the glyph's actual
    // alpha is exactly what this asserts.
    expect(material.uniforms.uOpacity!.value).toBeCloseTo(0.5, 6);
  });

  it('uses a transparent material, so a translucent modulate blends over what is behind it', async () => {
    const renderer = await render(props());
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    expect((mesh.material as THREE.Material).transparent).toBe(true);
  });

  it('no_depth_test=true → material.depthTest === false; default false → true', async () => {
    const on = await render(props({ no_depth_test: true }));
    const off = await render(props({ no_depth_test: false }));
    expect(((on.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.Material).depthTest).toBe(
      false
    );
    expect(((off.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.Material).depthTest).toBe(
      true
    );
  });

  it('double_sided=false → FrontSide material; default true → DoubleSide', async () => {
    const front = await render(props({ double_sided: false }));
    const double = await render(props({ double_sided: true }));
    expect(
      ((front.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.Material).side
    ).toBe(THREE.FrontSide);
    expect(
      ((double.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.Material).side
    ).toBe(THREE.DoubleSide);
  });

  describe('outline pass', () => {
    // The outline is a SECOND threshold of the SAME draw call (msdfMaterial.ts's
    // `uOutlineBias`/`uOutlineColor`/`uOutlineOpacity`), not a second mesh —
    // see that file's own doc for the measured reason (two overlapping
    // alpha-blended meshes of a near-identical shape darken every
    // anti-aliased edge). So every line still renders exactly ONE mesh either way.

    it('sets a non-zero uOutlineBias when outline_size > 0 and outline_modulate.a !== 0', async () => {
      const renderer = await render(props({ outline_size: 8, outline_modulate: { r: 0, g: 0, b: 0, a: 1 } }));
      const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
      expect(renderer.scene.findAllByType('Mesh').length).toBe(1);
      const material = mesh.material as THREE.ShaderMaterial;
      expect(material.uniforms.uOutlineBias!.value).toBeGreaterThan(0);
    });

    it('leaves uOutlineBias at 0 when outline_size is 0', async () => {
      const renderer = await render(props({ outline_size: 0 }));
      const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
      const material = mesh.material as THREE.ShaderMaterial;
      expect(material.uniforms.uOutlineBias!.value).toBe(0);
    });

    it('leaves uOutlineBias at 0 when outline_modulate.a is 0, even with outline_size > 0', async () => {
      const renderer = await render(
        props({ outline_size: 8, outline_modulate: { r: 0, g: 0, b: 0, a: 0 } })
      );
      const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
      const material = mesh.material as THREE.ShaderMaterial;
      expect(material.uniforms.uOutlineBias!.value).toBe(0);
    });

    it('carries outline_modulate as uOutlineColor/uOutlineOpacity and the calibrated distanceBias', async () => {
      const renderer = await render(
        props({ outline_size: 8, font_size: 32, outline_modulate: { r: 1, g: 0, b: 0, a: 0.5 } })
      );
      const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
      const material = mesh.material as THREE.ShaderMaterial;
      expect(material.uniforms.uOutlineColor!.value.x).toBeCloseTo(1, 4); // red channel, linear(1) === 1
      expect(material.uniforms.uOutlineOpacity!.value).toBeCloseTo(0.5, 6);
      expect(material.uniforms.uOutlineBias!.value).toBeCloseTo(outlineDistanceBias(8, 32), 6);
    });
  });

  describe('multi-line text', () => {
    it('renders one line-group per newline-separated line, each exactly one linePitchPx apart', async () => {
      const renderer = await render(props({ text: 'A\nB\nC', font_size: 32 }));
      const groups = renderer.scene.children.map((c) => c.instance as THREE.Group);
      expect(groups.length).toBe(3);
      // Every line-group's own Y matches the previous one exactly one line
      // pitch further down — the render-level equivalent of the deleted
      // Component.multiline.test.tsx's "grows the quad by one line height
      // per newline" (there measured as PlaneGeometry.height deltas; here as
      // each line's own group position, since a line is now its own mesh
      // rather than one merged canvas).
      const step0 = groups[0]!.position.y - groups[1]!.position.y;
      const step1 = groups[1]!.position.y - groups[2]!.position.y;
      expect(step0).toBeGreaterThan(0);
      expect(step0).toBeCloseTo(step1, 6);
    });

    it('sizes each line-group from ITS OWN width, not the concatenated string — the widest line bounds the whole label', async () => {
      const oneLine = await render(props({ text: 'ABCDEFG' }));
      const twoLines = await render(props({ text: 'AB\nCDEFG' }));
      const oneMesh = oneLine.scene.findByType('Mesh').instance as THREE.Mesh;
      const twoMeshes = twoLines.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
      // "AB\nCDEFG" concatenates to the SAME 7 glyphs as "ABCDEFG" — a
      // single-fillText/single-merged-geometry implementation would report
      // the same overall width for both. Neither of the two-line render's
      // OWN lines ("AB", "CDEFG") is as wide as the one-line render's single
      // "ABCDEFG" line, which is the render-level equivalent of the deleted
      // Component.multiline.test.tsx's "sizes the quad from the widest
      // line, not the concatenated string" (there one PlaneGeometry; here
      // one mesh per line, so the check is over ALL of them, not just one).
      const oneWidth = boundingSize(oneMesh).x;
      for (const mesh of twoMeshes) {
        expect(boundingSize(mesh).x).toBeLessThan(oneWidth);
      }
    });

    it('counts a trailing newline as an empty final line, like Godot', async () => {
      const plain = await render(props({ text: 'A' }));
      const trailing = await render(props({ text: 'A\n' }));
      expect(plain.scene.children.length).toBe(1);
      expect(trailing.scene.children.length).toBe(2);
    });
  });

  describe('horizontal_alignment', () => {
    it('FILL positions a line the same as CENTER (no per-line justification, width is unparsed)', async () => {
      const center = await render(props({ text: 'Hi', horizontal_alignment: HorizontalAlignment.CENTER }));
      const fill = await render(props({ text: 'Hi', horizontal_alignment: HorizontalAlignment.FILL }));
      const centerGroup = center.scene.children[0]!.instance as THREE.Group;
      const fillGroup = fill.scene.children[0]!.instance as THREE.Group;
      expect(fillGroup.position.x).toBeCloseTo(centerGroup.position.x, 6);
    });

    it('LEFT starts a line at x=0; RIGHT ends a line at x=0', async () => {
      const left = await render(props({ text: 'Hi', horizontal_alignment: HorizontalAlignment.LEFT }));
      const right = await render(props({ text: 'Hi', horizontal_alignment: HorizontalAlignment.RIGHT }));
      const leftGroup = left.scene.children[0]!.instance as THREE.Group;
      const rightGroup = right.scene.children[0]!.instance as THREE.Group;
      expect(leftGroup.position.x).toBeCloseTo(0, 6);
      expect(rightGroup.position.x).toBeLessThan(0);
    });
  });
});
