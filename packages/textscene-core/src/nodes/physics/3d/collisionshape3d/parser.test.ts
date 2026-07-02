import { describe, expect, it } from 'vitest';
import { parseCollisionShape3D } from './parser';
import { heading } from '../../../../parser/testing/parserKit';

describe('parseCollisionShape3D', () => {
  it('captures the shape reference and transform', () => {
    const props = parseCollisionShape3D(heading('CollisionShape3D', { name: 'Col' }), {
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)',
      shape: 'SubResource("BoxShape3D_1")',
    });
    expect(props.shape).toBe('SubResource("BoxShape3D_1")');
    expect(props.transform?.origin.y).toBeCloseTo(1, 5);
  });

  it('parses the disabled flag', () => {
    const props = parseCollisionShape3D(heading('CollisionShape3D', { name: 'Col' }), {
      disabled: 'true',
    });
    expect(props.disabled).toBe(true);
  });
});
