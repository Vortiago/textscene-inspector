/** The SHAPE_3D kind reads a Shape3D the same from each origin, and refuses any other class. */

import { describe, expect, it } from 'vitest';
import { snapshotOver } from '../../reading/snapshot';
import { nodeReference } from '../../reading/scopedReference';
import { loadedAt, originsOf, sceneTables } from '../../reading/reading.testkit';
import { SHAPE_3D } from './kind';

const SHAPE_CLASSES = [
  'BoxShape3D',
  'CapsuleShape3D',
  'SphereShape3D',
  'CylinderShape3D',
  'WorldBoundaryShape3D',
  'HeightMapShape3D',
  'SeparationRayShape3D',
  'ConcavePolygonShape3D',
  'ConvexPolygonShape3D',
];

const { inScene, elsewhere } = originsOf('BoxShape3D', 'size = Vector3(3, 4, 5)');

describe('the SHAPE_3D kind', () => {
  it('decodes the class and the properties of a shape of the scene', () => {
    expect(loadedAt(SHAPE_3D, inScene)).toEqual({ type: 'BoxShape3D', data: { size: 'Vector3(3, 4, 5)' } });
  });

  it.each(elsewhere)('decodes the same shape from $name', (origin) => {
    expect(loadedAt(SHAPE_3D, origin)).toEqual(loadedAt(SHAPE_3D, inScene));
  });

  it.each(SHAPE_CLASSES)('accepts %s', (className) => {
    expect(SHAPE_3D.accepts(className)).toBe(true);
  });

  it('refuses a resource that is no Shape3D, as the shape slot of Godot does', () => {
    const scene = sceneTables('[sub_resource type="BoxMesh" id="m"]');
    const read = snapshotOver({ getCached: () => null }).read(
      nodeReference('SubResource("m")', scene),
      SHAPE_3D
    );
    expect(read).toMatchObject({ status: 'unavailable', reason: 'wrong-type' });
  });
});
