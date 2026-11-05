import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  geometryPrimitive,
  godotSurfacesGeometry,
  type GodotSurface,
} from '../../resources/meshes/godotSurface';
import { canvasMeshGeometry } from './canvasMeshGeometry';

/** A quad from (0,10,5) to (100,110,5) with a normal, UVs and colours, as `godotSurfacesGeometry` builds it. */
function quadGeometry(): THREE.BufferGeometry {
  const surface: GodotSurface = {
    positions: new Float32Array([0, 10, 5, 100, 10, 5, 100, 110, 5, 0, 110, 5]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    colors: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]),
    indices: [0, 1, 2, 0, 2, 3],
  };
  return godotSurfacesGeometry([surface]);
}

describe('canvasMeshGeometry', () => {
  it("draws each vertex at Godot's x and y, with y down, and drops z", () => {
    const positions = canvasMeshGeometry(quadGeometry()).getAttribute('position');

    expect(positions.itemSize).toBe(3);
    expect(Array.from(positions.array)).toEqual([0, -10, 0, 100, -10, 0, 100, -110, 0, 0, -110, 0]);
  });

  it('keeps the UV, the colour and the draw order', () => {
    const source = quadGeometry();
    const canvas = canvasMeshGeometry(source);

    expect(Array.from(canvas.getAttribute('uv').array)).toEqual(Array.from(source.getAttribute('uv').array));
    expect(Array.from(canvas.getAttribute('color').array)).toEqual(
      Array.from(source.getAttribute('color').array)
    );
    expect(Array.from(canvas.getIndex()!.array)).toEqual(Array.from(source.getIndex()!.array));
  });

  it('carries no lighting attribute, which the canvas never reads', () => {
    const canvas = canvasMeshGeometry(quadGeometry());

    expect(canvas.hasAttribute('normal')).toBe(false);
    expect(canvas.hasAttribute('tangent')).toBe(false);
  });

  it('adds no colour or UV to a surface with none', () => {
    const bare = godotSurfacesGeometry([
      { positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), indices: [0, 1, 2] },
    ]);
    const canvas = canvasMeshGeometry(bare);

    expect(canvas.hasAttribute('color')).toBe(false);
    expect(canvas.hasAttribute('uv')).toBe(false);
  });

  it('stays a points geometry or a lines geometry, for the object that draws it', () => {
    const bare = { positions: new Float32Array([0, 0, 0, 1, 0, 0]), indices: [0, 1] };
    const points = canvasMeshGeometry(godotSurfacesGeometry([{ ...bare, primitive: 'points' }]));
    const lines = canvasMeshGeometry(godotSurfacesGeometry([{ ...bare, primitive: 'lines' }]));

    expect([geometryPrimitive(points), geometryPrimitive(lines)]).toEqual(['points', 'lines']);
  });

  it('leaves the source geometry as it was', () => {
    const source = quadGeometry();
    canvasMeshGeometry(source);

    expect(source.getAttribute('position').getY(2)).toBe(110);
  });
});
