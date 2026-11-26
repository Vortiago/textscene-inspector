import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { attributesGeometry } from '../../../shaders/canvas/canvasAttributes';
import { canvasSurfaceGeometry } from '../../../r3f/canvasMesh/canvasSurface';
import { writeSkinnedPoints } from './skinnedPointsWrite';

const POINTS = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 10 },
];
const MOVED = [
  { x: 1, y: 2 },
  { x: 3, y: 4 },
  { x: 5, y: 6 },
];

describe('writeSkinnedPoints', () => {
  it("writes a classic mesh's positions in three's frame, y up", () => {
    const geometry = canvasSurfaceGeometry({
      positions: Float32Array.from(POINTS.flatMap(({ x, y }) => [x, y])),
    });
    writeSkinnedPoints(geometry, MOVED);

    expect([...geometry.getAttribute('position').array]).toEqual([1, -2, 0, 3, -4, 0, 5, -6, 0]);
  });

  it("writes the canvas template's vertex array in Godot's frame, as the skeleton pass hands it the canvas draw", () => {
    const arrays = { primitive: 'triangles' as const, points: POINTS, colors: [], uvs: [] };
    const geometry = attributesGeometry(arrays, { customsRead: [], emulatesPoints: false });
    const vertices = geometry.getAttribute('vertex_attrib');
    const version = (vertices as THREE.BufferAttribute).version;
    writeSkinnedPoints(geometry, MOVED);

    expect([[...vertices.array], (vertices as THREE.BufferAttribute).version > version]).toEqual([
      [1, 2, 3, 4, 5, 6],
      true,
    ]);
  });

  it('makes no box for a template geometry that has none', () => {
    const arrays = { primitive: 'triangles' as const, points: POINTS, colors: [], uvs: [] };
    const geometry = attributesGeometry(arrays, { customsRead: [], emulatesPoints: false });
    geometry.boundingBox = null;
    writeSkinnedPoints(geometry, MOVED);

    expect(geometry.boundingBox).toBeNull();
  });
});
