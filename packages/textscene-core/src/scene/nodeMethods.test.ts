import { describe, expect, it } from 'vitest';
import { accessorOf } from '../godot/classdb/propertyMethod';
import { portedAccessors } from './nodeMethods';

describe('a ported setter or getter', () => {
  it.each(portedAccessors().map((entry) => [`${entry.className}::${entry.name}`, entry] as const))(
    '%s is the method ClassDB names for its property',
    (_, { className, name, method }) => {
      expect(accessorOf(method.accessor!.role, className, method.accessor!.property)).toBe(name);
    }
  );
});
