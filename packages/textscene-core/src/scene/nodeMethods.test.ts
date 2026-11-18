import { describe, expect, it } from 'vitest';
import { accessorOf } from '../godot/classdb/propertyMethod';
import { findPortedAccessor } from './nodeMethods';

const ACCESSORS = [
  ['Camera3D', 'setter', 'current'],
  ['Camera3D', 'getter', 'current'],
  ['Camera2D', 'setter', 'enabled'],
] as const;

describe('a ported setter or getter', () => {
  it.each(ACCESSORS)('of %s, the %s of %s, is the method ClassDB names', (className, role, property) => {
    expect(findPortedAccessor(className, role, property)?.name).toBe(accessorOf(role, className, property));
  });
});
