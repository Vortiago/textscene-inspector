import { describe, expect, it } from 'vitest';
import { headingAttribute } from './ranges';

describe('headingAttribute', () => {
  it('spans a quoted value inside its quotes', () => {
    const line = '[node name="Box" type="MeshInstance3D" parent="."]';

    expect(headingAttribute(line, 'type')).toEqual({
      span: { start: 23, end: 37 },
      value: 'MeshInstance3D',
    });
  });

  it('spans an old-style bare integer id', () => {
    const line = '[sub_resource type="SpatialMaterial" id=1]';

    expect(headingAttribute(line, 'id')).toEqual({ span: { start: 40, end: 41 }, value: '1' });
  });

  it('gives nothing for a heading that lacks the key', () => {
    expect(headingAttribute('[node name="Box"]', 'type')).toBeUndefined();
  });

  it("skips a key spelled inside another attribute's quoted value", () => {
    const line = '[node name="Box type=Mesh" type="MeshInstanc3D"]';

    expect(headingAttribute(line, 'type')?.value).toBe('MeshInstanc3D');
  });
});
