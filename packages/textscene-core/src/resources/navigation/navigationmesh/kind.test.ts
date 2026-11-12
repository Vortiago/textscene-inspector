/** The NAVIGATION_MESH kind reads a NavigationMesh the same from each origin. */

import { describe, expect, it } from 'vitest';
import { nodeReference } from '../../reading/scopedReference';
import { loadedAt, originsOf, sceneTables } from '../../reading/reading.testkit';
import { staticSnapshot } from '../../reading/staticSnapshot.testkit';
import { NAVIGATION_MESH } from './kind';

const BODY =
  'vertices = PackedVector3Array(0, 0, 0, 1, 0, 0, 1, 0, 1)\npolygons = [PackedInt32Array(0, 1, 2)]';
const { inScene, elsewhere } = originsOf('NavigationMesh', BODY);

describe('the NAVIGATION_MESH kind', () => {
  it('decodes the polygons of a mesh of the scene', () => {
    expect(loadedAt(NAVIGATION_MESH, inScene).polygons).toEqual([[0, 1, 2]]);
  });

  it.each(elsewhere)('decodes the same mesh from $name', (origin) => {
    expect(loadedAt(NAVIGATION_MESH, origin)).toEqual(loadedAt(NAVIGATION_MESH, inScene));
  });

  it('declines a mesh that has no surface', () => {
    const { ref, scene } = originsOf('NavigationMesh', '').inScene;
    const read = staticSnapshot({}).read(nodeReference(ref, sceneTables(scene)), NAVIGATION_MESH);
    expect(read).toMatchObject({ status: 'unavailable', reason: 'undecodable' });
  });

  it('refuses a class that is no NavigationMesh', () => {
    expect(NAVIGATION_MESH.accepts('NavigationPolygon')).toBe(false);
  });
});
