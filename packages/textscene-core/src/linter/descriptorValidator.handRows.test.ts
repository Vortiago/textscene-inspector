import { describe, expect, it } from 'vitest';
import { descriptorValidator } from './descriptorValidator.js';
import { handRowKeys, propertyDescriptor } from '../godot/classdb/propertyDescriptor.js';
import './index.js'; // side-effect: every slice registers its hand rows

describe('every registered hand row', () => {
  // A check is built on first lookup, so a fact it cannot carry would throw on a user's scene.
  it('builds into its derived check', () => {
    const keys = handRowKeys();
    expect(keys.length).toBeGreaterThanOrEqual(7);
    const refused = keys.flatMap(({ className, key }) => {
      try {
        descriptorValidator(propertyDescriptor(className, key)!);
        return [];
      } catch (error) {
        return [String(error)];
      }
    });
    expect(refused).toEqual([]);
  });
});
