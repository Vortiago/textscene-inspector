/** A NavigationPolygon decodes to its vertices and polygons from every origin. */

import { describeKindFromEveryOrigin } from '../../reading/everyOrigin.testkit';
import { NAVIGATION_POLYGON } from './decode';

describeKindFromEveryOrigin([
  {
    kind: NAVIGATION_POLYGON,
    className: 'NavigationPolygon',
    body: 'vertices = PackedVector2Array(0, 0, 10, 0, 10, 10)\npolygons = Array[PackedInt32Array]([PackedInt32Array(0, 1, 2)])',
    summarise: (polygon) => ({ vertices: [...polygon.vertices], polygons: polygon.polygons }),
    expected: { vertices: [0, 0, 10, 0, 10, 10], polygons: [[0, 1, 2]] },
  },
]);
