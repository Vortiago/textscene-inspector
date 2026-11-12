/** The OCCLUDER_3D kind reads an Occluder3D the same from each origin, and refuses any other class. */

import { describe, expect, it } from 'vitest';
import { loadedAt, originsOf } from '../../../resources/reading/reading.testkit';
import { OCCLUDER_3D } from './decodeOccluder';

const [inScene, ...elsewhere] = originsOf('BoxOccluder3D', 'size = Vector3(2, 3, 4)');

describe('the OCCLUDER_3D kind', () => {
  it('decodes a box occluder of the scene', () => {
    expect(loadedAt(OCCLUDER_3D, inScene!)).toEqual({ kind: 'box', size: { x: 2, y: 3, z: 4 } });
  });

  it.each(elsewhere)('decodes the same occluder from $name', (origin) => {
    expect(loadedAt(OCCLUDER_3D, origin)).toEqual(loadedAt(OCCLUDER_3D, inScene!));
  });

  it.each(['BoxOccluder3D', 'QuadOccluder3D', 'SphereOccluder3D', 'PolygonOccluder3D', 'ArrayOccluder3D'])(
    'accepts %s',
    (className) => {
      expect(OCCLUDER_3D.accepts(className)).toBe(true);
    }
  );

  it('refuses a class that is no Occluder3D', () => {
    expect(OCCLUDER_3D.accepts('BoxShape3D')).toBe(false);
  });
});
