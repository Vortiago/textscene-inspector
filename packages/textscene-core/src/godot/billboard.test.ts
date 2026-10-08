import { describe, expect, it } from 'vitest';
import { BillboardMode, billboardAabbCentre } from './billboard';

const QUAD_CENTRE = { x: 1.5, y: -2, z: 0.25 };

describe('billboardAabbCentre', () => {
  it('keeps the box centre of a quad that does not billboard', () => {
    expect(billboardAabbCentre(QUAD_CENTRE, BillboardMode.BILLBOARD_DISABLED)).toEqual(QUAD_CENTRE);
  });

  it('centres an ENABLED billboard on its origin', () => {
    expect(billboardAabbCentre(QUAD_CENTRE, BillboardMode.BILLBOARD_ENABLED)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('centres a FIXED_Y billboard on its Y axis, at the height of its box', () => {
    expect(billboardAabbCentre(QUAD_CENTRE, BillboardMode.BILLBOARD_FIXED_Y)).toEqual({ x: 0, y: -2, z: 0 });
  });
});
