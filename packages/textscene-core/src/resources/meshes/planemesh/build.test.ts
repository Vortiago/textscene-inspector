import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildPlaneMeshGeometry } from './build';
import { decodeQuadMesh } from '../quadmesh/decode';

const params = (g: object) => (g as { parameters: Record<string, number> }).parameters;

describe('buildPlaneMeshGeometry for a QuadMesh', () => {
  it('maps the witnessed size = Vector2(200, 200) to a 200×200 plane', () => {
    const geometry = buildPlaneMeshGeometry(decodeQuadMesh({ size: 'Vector2(200, 200)' }));

    expect(params(geometry)).toMatchObject({ width: 200, height: 200 });
  });

  it('defaults to a 1×1 quad facing +Z (no rotation applied)', () => {
    const geometry = buildPlaneMeshGeometry(decodeQuadMesh({}));

    expect(params(geometry)).toMatchObject({ width: 1, height: 1 });
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.getSize(new THREE.Vector3()).z).toBe(0);
  });
});
