/** The OCCLUDER_3D kind reads an Occluder3D the same from each origin, and refuses any other class. */

import { describe, expect, it } from 'vitest';
import { describeKindFromEveryOrigin } from '../../../resources/reading/everyOrigin.testkit';
import { OCCLUDER_3D } from './kind';

describeKindFromEveryOrigin([
  {
    kind: OCCLUDER_3D,
    className: 'BoxOccluder3D',
    body: 'size = Vector3(2, 3, 4)',
    expected: { kind: 'box', size: { x: 2, y: 3, z: 4 } },
  },
]);

describe('the OCCLUDER_3D kind', () => {
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
