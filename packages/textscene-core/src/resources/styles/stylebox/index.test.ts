/**
 * The routing claim (ADR-0031): exactly the two box types this slice decodes,
 * on the generic resource bus.
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
        failureLabel: 'Resource',
      });
    }
  });

  it('routes both to the resource processor (a ParsedResource, not a texture)', () => {
    expect(resourceSliceRegistry.busTypeFor('StyleBoxFlat')).toBe('resource');
    expect(resourceSliceRegistry.busTypeFor('StyleBoxEmpty')).toBe('resource');
  });

  it('leaves the box types it cannot decode unclaimed', () => {
    // A claim would promise a decode; StyleBoxTexture and StyleBoxLine have none
    // here, so they must not resolve to this slice.
    expect(resourceSliceRegistry.byTypeName('StyleBoxTexture')).toBeNull();
    expect(resourceSliceRegistry.byTypeName('StyleBoxLine')).toBeNull();
  });
});
