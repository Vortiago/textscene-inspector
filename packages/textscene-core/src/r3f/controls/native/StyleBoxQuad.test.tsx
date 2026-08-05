/**
 * `<StyleBoxQuad>` — renders `styleBoxFlatGeometry`'s output as a
 * `BufferGeometry` mesh, the "house recipe" 2D material every flat-shaded
 * canvas item in this codebase uses (`meshBasicMaterial`, `vertexColors`,
 * `transparent`, `depthWrite={false}`, `THREE.DoubleSide` — see
 * `nodes/2d/polygon2d/Component.tsx`'s `FilledPolygon`).
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { StyleBoxQuad } from './StyleBoxQuad';
import type { StyleBoxFlatData } from './styleBoxFlat';
import { sRGBChannelToLinear } from '../../../utils/colorSpace';

const ZERO_SIDES = { left: 0, top: 0, right: 0, bottom: 0 };
const ZERO_CORNERS = { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 };

function box(overrides: Partial<StyleBoxFlatData>): StyleBoxFlatData {
  return {
    bgColor: { r: 1, g: 0, b: 0, a: 1 },
    borderColor: { r: 0, g: 1, b: 0, a: 1 },
    borderWidth: { ...ZERO_SIDES },
    cornerRadius: { ...ZERO_CORNERS },
    expandMargin: { ...ZERO_SIDES },
    contentMargin: { ...ZERO_SIDES },
    drawCenter: true,
    borderBlend: false,
    ...overrides,
  };
}

describe('<StyleBoxQuad>', () => {
  it('builds an indexed BufferGeometry matching styleBoxFlatGeometry\'s vertex/index counts', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StyleBoxQuad styleBox={box({})} rect={{ x: 0, y: 0, w: 100, h: 50 }} />
    );
    const geom = renderer.scene.findByType('Mesh').instance.geometry as THREE.BufferGeometry;
    // Sharp rect, draw_center only: 8 vertices, 6 triangles (see
    // styleBoxFlatGeometry.test.ts's "a sharp rect" case for the derivation).
    expect(geom.attributes.position.count).toBe(8);
    expect(geom.getIndex()!.count).toBe(18);
    expect(geom.attributes.color.count).toBe(8);
    expect(geom.attributes.color.itemSize).toBe(4);
  });

  it('applies the house material recipe: vertex colours, transparent, no depth write, double-sided', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StyleBoxQuad styleBox={box({})} rect={{ x: 0, y: 0, w: 100, h: 50 }} />
    );
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    expect(mat.type).toBe('MeshBasicMaterial');
    expect(mat.vertexColors).toBe(true);
    expect(mat.transparent).toBe(true);
    expect(mat.depthWrite).toBe(false);
    expect(mat.side).toBe(THREE.DoubleSide);
  });

  it('linearises sRGB vertex colours (fill red 1,0,0 stays 1,0,0; a mid green channel is NOT passed through raw)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StyleBoxQuad
        styleBox={box({ bgColor: { r: 1, g: 0.5, b: 0, a: 1 } })}
        rect={{ x: 0, y: 0, w: 100, h: 50 }}
      />
    );
    const geom = renderer.scene.findByType('Mesh').instance.geometry as THREE.BufferGeometry;
    const color = geom.attributes.color as THREE.BufferAttribute;
    // sRGBChannelToLinear(0.5) = ((0.5+0.055)/1.055)^2.4 ≈ 0.2140.
    expect(color.getX(0)).toBeCloseTo(1, 4);
    expect(color.getY(0)).toBeCloseTo(0.214041, 4);
    expect(color.getZ(0)).toBeCloseTo(0, 4);
    expect(color.getW(0)).toBeCloseTo(1, 4);
  });

  it('renders nothing (no mesh) when the stylebox draws no geometry (draw_center false, no border)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StyleBoxQuad styleBox={box({ drawCenter: false })} rect={{ x: 0, y: 0, w: 100, h: 50 }} />
    );
    expect(() => renderer.scene.findByType('Mesh')).toThrow();
  });

  it('disposes the previous geometry when the stylebox changes', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StyleBoxQuad styleBox={box({})} rect={{ x: 0, y: 0, w: 100, h: 50 }} />
    );
    const firstGeom = renderer.scene.findByType('Mesh').instance.geometry as THREE.BufferGeometry;
    const disposeSpy = vi.spyOn(firstGeom, 'dispose');

    await renderer.update(
      <StyleBoxQuad
        styleBox={box({ bgColor: { r: 0, g: 0, b: 1, a: 1 } })}
        rect={{ x: 0, y: 0, w: 100, h: 50 }}
      />
    );

    expect(disposeSpy).toHaveBeenCalled();
  });

  describe('color override', () => {
    it('composes the tint into bg_color/border_color in raw sRGB ONCE, before the single sRGB→linear conversion — 0.5 * 0.5 = 0.25, not 0.125', async () => {
      // The composed channel is 0.5 (widget) * 0.5 (tint) = 0.25 in sRGB,
      // converted to linear EXACTLY once. Double-linearisation (converting
      // both operands first, THEN multiplying in linear space) would instead
      // give sRGBChannelToLinear(0.5) ** 2 ≈ 0.0334 — an entirely different,
      // much darker number this test also rules out.
      const renderer = await ReactThreeTestRenderer.create(
        <StyleBoxQuad
          styleBox={box({ bgColor: { r: 0.5, g: 0.5, b: 0.5, a: 1 } })}
          rect={{ x: 0, y: 0, w: 100, h: 50 }}
          color={{ r: 0.5, g: 0.5, b: 0.5, a: 1 }}
          renderOrder={0}
        />
      );
      const geom = renderer.scene.findByType('Mesh').instance.geometry as THREE.BufferGeometry;
      const color = geom.attributes.color as THREE.BufferAttribute;

      const composedOnce = sRGBChannelToLinear(0.25);
      const doubleLinearised = sRGBChannelToLinear(0.5) * sRGBChannelToLinear(0.5);
      expect(composedOnce).not.toBeCloseTo(doubleLinearised, 3);

      expect(color.getX(0)).toBeCloseTo(composedOnce, 5);
      expect(color.getY(0)).toBeCloseTo(composedOnce, 5);
      expect(color.getZ(0)).toBeCloseTo(composedOnce, 5);
    });

    it('tints borderColor the same way as bgColor', async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <StyleBoxQuad
          styleBox={box({ borderColor: { r: 0.5, g: 0.5, b: 0.5, a: 1 }, borderWidth: { left: 5, top: 5, right: 5, bottom: 5 } })}
          rect={{ x: 0, y: 0, w: 100, h: 50 }}
          color={{ r: 0.5, g: 0.5, b: 0.5, a: 1 }}
          renderOrder={0}
        />
      );
      const geom = renderer.scene.findByType('Mesh').instance.geometry as THREE.BufferGeometry;
      const color = geom.attributes.color as THREE.BufferAttribute;
      // Vertex 1 is the border ring's first OUTER (border_color) vertex — see
      // styleBoxFlatGeometry.test.ts's border_blend fixture for the even/odd
      // inner/outer ordering this relies on.
      expect(color.getX(1)).toBeCloseTo(sRGBChannelToLinear(0.25), 5);
    });

    it('defaults to no tint (opaque white) when the prop is omitted, matching pre-existing behaviour', async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <StyleBoxQuad styleBox={box({ bgColor: { r: 0.8, g: 0.8, b: 0.8, a: 1 } })} rect={{ x: 0, y: 0, w: 100, h: 50 }} renderOrder={0} />
      );
      const geom = renderer.scene.findByType('Mesh').instance.geometry as THREE.BufferGeometry;
      const color = geom.attributes.color as THREE.BufferAttribute;
      expect(color.getX(0)).toBeCloseTo(sRGBChannelToLinear(0.8), 5);
    });

    it('multiplies alpha too (tint.a composes into the vertex alpha channel)', async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <StyleBoxQuad
          styleBox={box({ bgColor: { r: 1, g: 1, b: 1, a: 0.8 } })}
          rect={{ x: 0, y: 0, w: 100, h: 50 }}
          color={{ r: 1, g: 1, b: 1, a: 0.5 }}
          renderOrder={0}
        />
      );
      const geom = renderer.scene.findByType('Mesh').instance.geometry as THREE.BufferGeometry;
      const color = geom.attributes.color as THREE.BufferAttribute;
      expect(color.getW(0)).toBeCloseTo(0.4, 5);
    });
  });
});
