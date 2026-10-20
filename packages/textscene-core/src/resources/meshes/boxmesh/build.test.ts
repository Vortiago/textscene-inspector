import { describe, expect, it } from 'vitest';
import { buildBoxMeshGeometry } from './build';
import { decodeBoxMesh } from './decode';

const params = (g: object) => (g as { parameters: Record<string, number> }).parameters;

describe('buildBoxMeshGeometry', () => {
  it('maps Godot subdivide_* (extra edge loops) to N+1 segments', () => {
    const geometry = buildBoxMeshGeometry(
      decodeBoxMesh({ subdivide_width: '2', subdivide_height: '3', subdivide_depth: '4' })
    );

    expect(params(geometry)).toMatchObject({ widthSegments: 3, heightSegments: 4, depthSegments: 5 });
  });
});
