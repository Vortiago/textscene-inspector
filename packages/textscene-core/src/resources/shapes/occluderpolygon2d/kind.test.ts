/** An OccluderPolygon2D decodes to its polygon, closure and cull mode from every origin. */

import { describeKindFromEveryOrigin } from '../../reading/everyOrigin.testkit';
import { OccluderPolygon2DCullMode } from '../../../godot/scene/lightOccluder2d';
import { OCCLUDER_POLYGON_2D } from './decode';

describeKindFromEveryOrigin([
  {
    kind: OCCLUDER_POLYGON_2D,
    className: 'OccluderPolygon2D',
    body: 'closed = false\ncull_mode = 1\npolygon = PackedVector2Array(0, 0, 16, 0, 16, 16)',
    summarise: (occluder) => ({ ...occluder, polygon: [...occluder.polygon] }),
    expected: {
      polygon: [0, 0, 16, 0, 16, 16],
      isClosed: false,
      cullMode: OccluderPolygon2DCullMode.CLOCKWISE,
    },
  },
]);
