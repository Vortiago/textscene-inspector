import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  geometryPrimitive,
  godotSurfacesGeometry,
  type GodotSurface,
} from '../../resources/meshes/godotSurface';
import type { MultiMeshInstance } from '../../resources/meshes/multimesh';
import { canvasInstancesGeometry } from './canvasMeshInstances';

/** A 10 by 10 quad at the origin, with UVs, as `godotSurfacesGeometry` builds it. */
function quad(extra: Partial<GodotSurface> = {}): THREE.BufferGeometry {
  return godotSurfacesGeometry([
    {
      positions: new Float32Array([0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0]),
      uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      indices: [0, 1, 2, 0, 2, 3],
      ...extra,
    },
  ]);
}

/** An instance with the 2D transform `[xx, xy, 0, ox, yx, yy, 0, oy]`. */
function instance(
  transform: number[],
  color: number[] | null = null,
  customData: number[] | null = null
): MultiMeshInstance {
  return {
    transform: new Float32Array(transform),
    color: color && new Float32Array(color),
    customData: customData && new Float32Array(customData),
  };
}

const AT_ORIGIN = [1, 0, 0, 0, 0, 1, 0, 0];
const attribute = (geometry: THREE.BufferGeometry, name: string) =>
  Array.from(geometry.getAttribute(name).array);

describe('canvasInstancesGeometry', () => {
  it("draws each instance's copy under its 2D transform, with y down", () => {
    const turned = instance([0, -1, 0, 50, 1, 0, 0, 20]);
    const geometry = canvasInstancesGeometry(quad(), [instance(AT_ORIGIN), turned], null);

    const positions = attribute(geometry, 'position');
    // Instance 0 is the canvas quad: y negated into the world.
    expect(positions.slice(0, 12)).toEqual([0, -0, 0, 10, -0, 0, 10, -10, 0, 0, -10, 0]);
    // Instance 1: (x, y) → (-y + 50, x + 20), so the corner (10, 0) lands on (50, 30).
    expect(positions.slice(12, 18)).toEqual([50, -20, 0, 50, -30, 0]);
  });

  it('draws the instances in index order, one copy of the draw order after another', () => {
    const geometry = canvasInstancesGeometry(quad(), [instance(AT_ORIGIN), instance(AT_ORIGIN)], null);

    // godotSurfacesGeometry turns Godot's clockwise winding into three's.
    expect(Array.from(geometry.getIndex()!.array)).toEqual([0, 2, 1, 0, 3, 2, 4, 6, 5, 4, 7, 6]);
  });

  it('draws each surface for every instance before the next surface, as one instanced call per surface does', () => {
    const triangle = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), indices: [0, 1, 2] };
    const twoSurfaces = godotSurfacesGeometry([triangle, triangle]);
    const geometry = canvasInstancesGeometry(twoSurfaces, [instance(AT_ORIGIN), instance(AT_ORIGIN)], null);

    // Vertices 0-2 are surface 0, 3-5 surface 1, and the second instance adds 6. Winding is reversed.
    expect(Array.from(geometry.getIndex()!.array)).toEqual([0, 2, 1, 6, 8, 7, 3, 5, 4, 9, 11, 10]);
  });

  it('copies the UV of the mesh for each instance', () => {
    const geometry = canvasInstancesGeometry(quad(), [instance(AT_ORIGIN), instance(AT_ORIGIN)], null);

    // three's V runs up, so Godot's (0,0) is (0,1).
    expect(attribute(geometry, 'uv')).toEqual([0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0]);
  });

  it('multiplies the vertex colour by the instance colour', () => {
    const vertexColours = new Uint8Array([
      255, 255, 255, 255, 255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255,
    ]);
    const geometry = canvasInstancesGeometry(
      quad({ colors: vertexColours }),
      [instance(AT_ORIGIN, [0.5, 1, 1, 0.5])],
      null
    );

    expect(attribute(geometry, 'color').slice(0, 8)).toEqual([0.5, 1, 1, 0.5, 0.5, 0, 0, 0.5]);
  });

  it('gives a mesh with no vertex colours the instance colour alone', () => {
    const geometry = canvasInstancesGeometry(quad(), [instance(AT_ORIGIN, [0, 0, 1, 1])], null);

    expect(attribute(geometry, 'color').slice(0, 4)).toEqual([0, 0, 1, 1]);
    expect(geometry.getAttribute('color').itemSize).toBe(4);
  });

  it('adds no colour when neither the mesh nor the instances have one', () => {
    expect(canvasInstancesGeometry(quad(), [instance(AT_ORIGIN)], null).hasAttribute('color')).toBe(false);
  });

  it('shrinks each instance to a flipbook cell and windows its UV to the cell custom z picks', () => {
    const flipbook = { hFrames: 2, vFrames: 1, loop: false };
    const geometry = canvasInstancesGeometry(
      quad(),
      [instance(AT_ORIGIN, null, [0, 0, 0, 0]), instance(AT_ORIGIN, null, [0, 0, 0.5, 0])],
      flipbook
    );

    expect(attribute(geometry, 'position').slice(3, 6)).toEqual([5, -0, 0]);
    expect(attribute(geometry, 'uv')).toEqual([0, 1, 0.5, 1, 0.5, 0, 0, 0, 0.5, 1, 1, 1, 1, 0, 0.5, 0]);
  });

  it('reads cell 0 for an instance with no custom data', () => {
    const flipbook = { hFrames: 2, vFrames: 1, loop: false };
    const geometry = canvasInstancesGeometry(quad(), [instance(AT_ORIGIN)], flipbook);

    expect(attribute(geometry, 'uv').slice(0, 4)).toEqual([0, 1, 0.5, 1]);
  });

  it('stays a points geometry or a lines geometry, for the object that draws it', () => {
    const bare = { positions: new Float32Array([0, 0, 0, 1, 0, 0]), indices: [0, 1] };
    const points = godotSurfacesGeometry([{ ...bare, primitive: 'points' }]);
    const lines = godotSurfacesGeometry([{ ...bare, primitive: 'lines' }]);

    expect(geometryPrimitive(canvasInstancesGeometry(points, [instance(AT_ORIGIN)], null))).toBe('points');
    expect(geometryPrimitive(canvasInstancesGeometry(lines, [instance(AT_ORIGIN)], null))).toBe('lines');
  });

  it('copies a mesh with no index buffer in vertex order', () => {
    const bare = new THREE.BufferGeometry();
    bare.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3)
    );
    const geometry = canvasInstancesGeometry(bare, [instance(AT_ORIGIN), instance(AT_ORIGIN)], null);

    expect(geometry.getAttribute('position').count).toBe(6);
    expect(geometry.getIndex()).toBeNull();
  });
});
