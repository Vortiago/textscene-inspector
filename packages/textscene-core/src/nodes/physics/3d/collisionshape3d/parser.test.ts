import { describe, expect, it } from 'vitest';
import { parseCollisionShape3D, isCollisionShape3D } from './parser';
import type { ParsedHeading } from '../../../../parser/utils';

function heading(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseCollisionShape3D', () => {
  it('captures the shape reference and transform', () => {
    const props = parseCollisionShape3D(heading({ name: 'Col', type: 'CollisionShape3D' }), {
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)',
      shape: 'SubResource("BoxShape3D_1")',
    });
    expect(props.shape).toBe('SubResource("BoxShape3D_1")');
    expect(props.transform?.origin.y).toBeCloseTo(1, 5);
  });

  it('parses the disabled flag', () => {
    const props = parseCollisionShape3D(heading({ name: 'Col', type: 'CollisionShape3D' }), {
      disabled: 'true',
    });
    expect(props.disabled).toBe(true);
  });
});

describe('isCollisionShape3D', () => {
  it('matches a CollisionShape3D heading', () => {
    expect(isCollisionShape3D(heading({ type: 'CollisionShape3D' }))).toBe(true);
  });

  it('rejects other types', () => {
    expect(isCollisionShape3D(heading({ type: 'StaticBody3D' }))).toBe(false);
  });
});
