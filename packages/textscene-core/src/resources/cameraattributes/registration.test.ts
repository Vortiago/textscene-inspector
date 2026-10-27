/**
 * The CameraAttributes slice's routing claims (ADR-0031). Importing the index registers them, and
 * these assertions are what a router reads back out.
 */

import { describe, expect, it } from 'vitest';
import { registerResourceSlice, resourceSliceRegistry } from '../sliceRegistration';
import './index';

describe('cameraattributes slice registration', () => {
  it.each(['CameraAttributesPractical', 'CameraAttributesPhysical'])(
    'claims %s for the generic resource bus slot, as Godot text',
    (typeName) => {
      const registration = resourceSliceRegistry.byTypeName(typeName);
      expect(registration?.slice).toBe('cameraattributes');
      expect(registration?.kind).toBe('godot-text');
      expect(registration?.busType).toBe('resource');
    }
  );

  it('rejects a second slice claiming CameraAttributesPractical', () => {
    expect(() =>
      registerResourceSlice({
        slice: 'not-cameraattributes',
        kind: 'godot-text',
        typeNames: ['CameraAttributesPractical'],
        busType: null,
      })
    ).toThrow(/already claimed by slice "cameraattributes"/);
  });
});
