/**
 * The primitive collision shapes validate their own radius/height: each has an
 * `ERR_FAIL_COND_MSG(... < 0)` setter and a `PROPERTY_HINT_RANGE` whose max is
 * `or_greater`, so the floor is two tiers and the ceiling is open.
 */

import { describe, it, expect } from 'vitest';
import { validatorRegistry } from '../../linter/ValidatorRegistry.js';
import '../../linter/index.js';

const check = (type: string, key: string, value: string) =>
  validatorRegistry.findValidator(type, key)?.(key, value, 1);

describe.each([
  ['SphereShape3D', 'radius', 0.001],
  ['CircleShape2D', 'radius', 0.01],
  ['CapsuleShape2D', 'radius', 0.01],
  ['CapsuleShape2D', 'height', 0.01],
  ['CapsuleShape3D', 'radius', 0.001],
  ['CapsuleShape3D', 'height', 0.001],
  ['CylinderShape3D', 'radius', 0.001],
  ['CylinderShape3D', 'height', 0.001],
])('%s.%s', (type, key, hintFloor) => {
  it('is validated at all', () => {
    expect(validatorRegistry.findValidator(type, key)).toBeDefined();
  });

  it('errors below 0, which the setter refuses', () => {
    expect(check(type, key, '-1.0')?.severity).toBe('error');
  });

  it('warns between the setter floor and the hint floor', () => {
    // 0 is stored (the guard is `< 0`) but outside the inspector's range.
    expect(check(type, key, '0.0')?.severity).toBe('warning');
  });

  it('accepts a value at the hint floor', () => {
    expect(check(type, key, String(hintFloor))).toBeNull();
  });

  it('accepts a value past the hint ceiling, which is or_greater', () => {
    expect(check(type, key, '100000.0')).toBeNull();
  });
});
