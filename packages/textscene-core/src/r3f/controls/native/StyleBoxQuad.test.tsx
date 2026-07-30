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
});
