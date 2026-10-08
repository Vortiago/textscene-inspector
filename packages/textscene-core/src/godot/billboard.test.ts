import { describe, expect, it } from 'vitest';
import { BillboardMode, labelBillboardAabb, spriteBillboardAabb } from './billboard';
import type { Aabb } from './aabb';

/** A label box 3 wide and 1 high, left of the origin by 1 and below it by 0.25. */
const LABEL_BOX: Aabb = { position: { x: -1, y: -0.25, z: 0 }, size: { x: 3, y: 1, z: 0 } };

describe('labelBillboardAabb', () => {
  it('keeps the box of a label that does not billboard', () => {
    expect(labelBillboardAabb(LABEL_BOX, BillboardMode.BILLBOARD_DISABLED)).toEqual(LABEL_BOX);
  });

  it('grows an ENABLED label to a cube about its origin, as wide as its farthest edge', () => {
    // max(|-1|, -1 + 3, |-0.25|, -0.25 + 1) = 2.
    expect(labelBillboardAabb(LABEL_BOX, BillboardMode.BILLBOARD_ENABLED)).toEqual({
      position: { x: -2, y: -2, z: -2 },
      size: { x: 4, y: 4, z: 4 },
    });
  });

  it('grows a FIXED_Y label to a prism about its Y axis that keeps its height', () => {
    expect(labelBillboardAabb(LABEL_BOX, BillboardMode.BILLBOARD_FIXED_Y)).toEqual({
      position: { x: -2, y: -0.25, z: -2 },
      size: { x: 4, y: 1, z: 4 },
    });
  });
});

/** A sprite quad 1 wide and 4 high on the Y axis plane: the quad lies along X and Z. */
const QUAD_ON_Y: Aabb = { position: { x: -0.5, y: 0, z: -2 }, size: { x: 1, y: 0, z: 4 } };
const QUAD_RECT_ON_Y: Aabb = { position: { x: -0.5, y: -2, z: 0 }, size: { x: 1, y: 4, z: 0 } };

describe('spriteBillboardAabb', () => {
  it('keeps the box of a sprite that does not billboard', () => {
    expect(spriteBillboardAabb(QUAD_ON_Y, QUAD_RECT_ON_Y, BillboardMode.BILLBOARD_DISABLED, 1)).toEqual(
      QUAD_ON_Y
    );
  });

  it('grows an ENABLED sprite to a cube from its 2D rect', () => {
    expect(spriteBillboardAabb(QUAD_ON_Y, QUAD_RECT_ON_Y, BillboardMode.BILLBOARD_ENABLED, 1)).toEqual({
      position: { x: -2, y: -2, z: -2 },
      size: { x: 4, y: 4, z: 4 },
    });
  });

  it('reads the rect height into a FIXED_Y prism only for the Y axis', () => {
    // On Y: max(0.5, 0.5, 2, 2) = 2. On Z the rect width alone: max(0.5, 0.5) = 0.5.
    expect(spriteBillboardAabb(QUAD_ON_Y, QUAD_RECT_ON_Y, BillboardMode.BILLBOARD_FIXED_Y, 1).size.x).toBe(4);
    expect(spriteBillboardAabb(QUAD_ON_Y, QUAD_RECT_ON_Y, BillboardMode.BILLBOARD_FIXED_Y, 2).size.x).toBe(1);
  });
});
