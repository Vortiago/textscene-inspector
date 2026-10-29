/**
 * Skin's properties: `bind_count` and the `bind/<i>/<leaf>` family, which `_get_property_list`
 * builds by hand (`scene/resources/3d/skin.cpp:132-139`).
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../linter/ValidatorRegistry';
import './linterValidators';

const find = (key: string) => validatorRegistry.findValidator('Skin', key);

/** Run the registered validator for `key`, or fail loudly when none resolves. */
function check(key: string, value: string) {
  const validator = find(key);
  expect(validator, `no validator for ${key}`).not.toBeNull();
  return validator!(key, value, 1);
}

const IDENTITY = 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)';

describe('Skin properties', () => {
  it('takes the values Godot writes', () => {
    expect(check('bind_count', '6')).toBeNull();
    expect(check('bind/0/name', '&"b0"')).toBeNull();
    expect(check('bind/0/bone', '3')).toBeNull();
    expect(check('bind/0/pose', IDENTITY)).toBeNull();
  });

  it('rejects a value the property cannot hold', () => {
    expect(check('bind_count', '"six"')).toBeAtTier('error');
    expect(check('bind/0/name', '3')).toBeAtTier('error');
    expect(check('bind/0/bone', '"b0"')).toBeAtTier('error');
    expect(check('bind/0/pose', 'Transform3D(1, 0, 0)')).toBeAtTier('error');
  });

  it('errors on a negative bind_count, which set_bind_count refuses (skin.cpp:34)', () => {
    expect(check('bind_count', '-1')).toBeAtTier('error');
  });

  it('warns on a negative bone index, which the hint floors at 0 (skin.cpp:137)', () => {
    expect(check('bind/0/bone', '-1')).toBeAtTier('warning');
  });

  it('errors on a negative bind index, which set_bind_* refuses (skin.cpp:56)', () => {
    expect(check('bind/-1/bone', '0')).toBeAtTier('error');
  });

  it('reports a leaf `_set` does not recognise, which returns false (skin.cpp:107)', () => {
    const out = check('bind/0/bogus', '1');
    expect(out).toBeAtTier('error');
    expect(out?.message).toContain('bind/0/bogus');
  });
});
