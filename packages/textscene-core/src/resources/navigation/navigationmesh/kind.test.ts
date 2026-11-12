/** The NAVIGATION_MESH kind reads a NavigationMesh the same from each origin. */

import { describe, expect, it } from 'vitest';
import { describeKindFromEveryOrigin } from '../../reading/everyOrigin.testkit';
import { nodeReference } from '../../reading/scopedReference';
import { sceneTables } from '../../reading/reading.testkit';
import { staticSnapshot } from '../../reading/staticSnapshot.testkit';
import { NAVIGATION_MESH } from './kind';

describeKindFromEveryOrigin([
  {
    kind: NAVIGATION_MESH,
    className: 'NavigationMesh',
    body: 'vertices = PackedVector3Array(0, 0, 0, 1, 0, 0, 1, 0, 1)\npolygons = [PackedInt32Array(0, 1, 2)]',
    expected: [[0, 1, 2]],
    summarise: (mesh) => mesh.polygons,
  },
]);

describe('the NAVIGATION_MESH kind', () => {
  it('declines a mesh that has no surface', () => {
    const scene = sceneTables('[sub_resource type="NavigationMesh" id="r"]');
    const read = staticSnapshot({}).read(nodeReference('SubResource("r")', scene), NAVIGATION_MESH);
    expect(read).toMatchObject({ status: 'unavailable', reason: 'undecodable' });
  });

  it('refuses a class that is no NavigationMesh', () => {
    expect(NAVIGATION_MESH.accepts('NavigationPolygon')).toBe(false);
  });
});
