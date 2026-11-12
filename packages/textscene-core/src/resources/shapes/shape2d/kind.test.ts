/** A Shape2D decodes to its outline from every origin, and only a Shape2D class decodes. */

import { describe, expect, it } from 'vitest';
import { describeKindFromEveryOrigin } from '../../reading/everyOrigin.testkit';
import { nodeReference } from '../../reading/scopedReference';
import { sceneTables } from '../../reading/reading.testkit';
import { staticSnapshot } from '../../reading/staticSnapshot.testkit';
import { SHAPE_2D } from './decode';

describeKindFromEveryOrigin([
  {
    kind: SHAPE_2D,
    className: 'RectangleShape2D',
    body: 'size = Vector2(40, 60)',
    expected: [
      { x: -20, y: -30 },
      { x: 20, y: -30 },
      { x: 20, y: 30 },
      { x: -20, y: 30 },
    ],
  },
  {
    kind: SHAPE_2D,
    className: 'CircleShape2D',
    body: 'radius = 5',
    summarise: (outline) => ({ count: outline.length, first: outline[0] }),
    expected: { count: 32, first: { x: 5, y: 0 } },
  },
  {
    kind: SHAPE_2D,
    className: 'CapsuleShape2D',
    body: 'radius = 10\nheight = 40',
    summarise: (outline) => ({ count: outline.length, width: Math.max(...outline.map((p) => p.x)) }),
    expected: { count: 34, width: 10 },
  },
]);

describe('the Shape2D kind on a resource of another class', () => {
  it('answers wrong-type for a Curve2D', () => {
    const scene = '[sub_resource type="Curve2D" id="c"]\n';

    const read = staticSnapshot({}).read(nodeReference('SubResource("c")', sceneTables(scene)), SHAPE_2D);

    expect(read).toMatchObject({ status: 'unavailable', reason: 'wrong-type' });
  });
});
