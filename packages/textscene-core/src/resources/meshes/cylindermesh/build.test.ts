import { describe, expect, it } from 'vitest';
import { buildCylinderMeshGeometry } from './build';
import { decodeCylinderMesh } from './decode';

const params = (g: object) => (g as { parameters: Record<string, number | boolean> }).parameters;

describe('buildCylinderMeshGeometry', () => {
  it('maps top/bottom radius and segment counts', () => {
    const geometry = buildCylinderMeshGeometry(
      decodeCylinderMesh({ top_radius: '0.25', bottom_radius: '0.75', radial_segments: '12', rings: '3' })
    );

    expect(params(geometry)).toMatchObject({
      radiusTop: 0.25,
      radiusBottom: 0.75,
      radialSegments: 12,
      heightSegments: 3,
    });
  });

  it('keeps caps by default (openEnded false)', () => {
    expect(params(buildCylinderMeshGeometry(decodeCylinderMesh({}))).openEnded).toBe(false);
  });

  it('opens the ends only when both caps are disabled', () => {
    const geometry = buildCylinderMeshGeometry(decodeCylinderMesh({ cap_top: 'false', cap_bottom: 'false' }));

    expect(params(geometry).openEnded).toBe(true);
  });

  it('keeps caps when only one cap is disabled (edge case)', () => {
    const topOnly = buildCylinderMeshGeometry(decodeCylinderMesh({ cap_top: 'false' }));
    const bottomOnly = buildCylinderMeshGeometry(decodeCylinderMesh({ cap_bottom: 'false' }));

    expect(params(topOnly).openEnded).toBe(false);
    expect(params(bottomOnly).openEnded).toBe(false);
  });
});
