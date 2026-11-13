/** A Shape2D decodes to its drawing from every origin, and only a Shape2D class decodes. */

import { describe, expect, it } from 'vitest';
import { describeKindFromEveryOrigin } from '../../reading/everyOrigin.testkit';
import { nodeReference } from '../../reading/scopedReference';
import { sceneTables } from '../../reading/reading.testkit';
import { staticSnapshot } from '../../reading/staticSnapshot.testkit';
import { SHAPE_2D } from './decode';
import type { ShapeDrawing } from './drawing';

/** The command kinds and the point count of the first command: enough to tell one class from another. */
function shape(drawing: ShapeDrawing) {
  return { kinds: drawing.map((c) => c.kind), points: drawing[0]?.points.length };
}

describeKindFromEveryOrigin([
  {
    kind: SHAPE_2D,
    className: 'RectangleShape2D',
    body: 'size = Vector2(40, 60)',
    summarise: shape,
    expected: { kinds: ['fill', 'hairline'], points: 4 },
  },
  {
    kind: SHAPE_2D,
    className: 'CircleShape2D',
    body: 'radius = 5',
    summarise: shape,
    expected: { kinds: ['fill', 'hairline'], points: 24 },
  },
  {
    kind: SHAPE_2D,
    className: 'CapsuleShape2D',
    body: 'radius = 10\nheight = 40',
    summarise: shape,
    expected: { kinds: ['fill', 'hairline'], points: 26 },
  },
  {
    kind: SHAPE_2D,
    className: 'SegmentShape2D',
    body: 'a = Vector2(1, 2)\nb = Vector2(30, 40)',
    summarise: shape,
    expected: { kinds: ['stroke'], points: 2 },
  },
  {
    kind: SHAPE_2D,
    className: 'ConvexPolygonShape2D',
    body: 'points = PackedVector2Array(0, 0, 10, 0, 5, 8)',
    summarise: shape,
    expected: { kinds: ['fill', 'hairline'], points: 3 },
  },
  {
    kind: SHAPE_2D,
    className: 'ConcavePolygonShape2D',
    body: 'segments = PackedVector2Array(0, 0, 10, 0, 10, 0, 5, 8)',
    summarise: shape,
    expected: { kinds: ['stroke', 'stroke'], points: 2 },
  },
  {
    kind: SHAPE_2D,
    className: 'WorldBoundaryShape2D',
    body: 'distance = 5.0',
    summarise: shape,
    expected: { kinds: ['stroke', 'stroke'], points: 4 },
  },
  {
    kind: SHAPE_2D,
    className: 'SeparationRayShape2D',
    body: 'length = 30.0',
    summarise: shape,
    expected: { kinds: ['stroke', 'fill'], points: 2 },
  },
]);

describe('the Shape2D kind on a resource of another class', () => {
  it('answers wrong-type for a Curve2D', () => {
    const scene = '[sub_resource type="Curve2D" id="c"]\n';

    const read = staticSnapshot({}).read(nodeReference('SubResource("c")', sceneTables(scene)), SHAPE_2D);

    expect(read).toMatchObject({ status: 'unavailable', reason: 'wrong-type' });
  });
});
