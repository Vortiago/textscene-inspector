/**
 * The routing claim (ADR-0031): `StyleBoxFlat` and `StyleBoxEmpty`, on the
 * generic resource bus.
 */

import { describe, expect, it } from 'vitest';
import './index';
import { resourceSliceRegistry } from '../../sliceRegistration';

describe('stylebox slice registration', () => {
  it('claims StyleBoxFlat and StyleBoxEmpty', () => {
    for (const typeName of ['StyleBoxFlat', 'StyleBoxEmpty']) {
      expect(resourceSliceRegistry.byTypeName(typeName)).toMatchObject({
        slice: 'stylebox',
        kind: 'godot-text',
        typeNames: ['StyleBoxFlat', 'StyleBoxEmpty'],
        busType: 'resource',
      });
    }
  });

  it('routes both to the resource processor (a ParsedResource, not a texture)', () => {
    expect(resourceSliceRegistry.byTypeName('StyleBoxFlat')?.busType ?? null).toBe('resource');
    expect(resourceSliceRegistry.byTypeName('StyleBoxEmpty')?.busType ?? null).toBe('resource');
  });

  it('leaves the other box types unclaimed', () => {
    // StyleBoxTexture and StyleBoxLine have no consumer here, so they must not
    // resolve to this slice.
    expect(resourceSliceRegistry.byTypeName('StyleBoxTexture')).toBeNull();
    expect(resourceSliceRegistry.byTypeName('StyleBoxLine')).toBeNull();
  });
});
