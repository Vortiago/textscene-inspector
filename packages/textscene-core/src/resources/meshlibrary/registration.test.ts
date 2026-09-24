/**
 * The MeshLibrary slice's routing claims (ADR-0031). Importing the index
 * registers them, and these assertions are what a router reads back out.
 */

import { describe, expect, it } from 'vitest';
import { registerResourceSlice, resourceSliceRegistry } from '../sliceRegistration';
import './index';

describe('meshlibrary slice registration', () => {
  it('claims MeshLibrary for the generic resource bus slot', () => {
    const registration = resourceSliceRegistry.byTypeName('MeshLibrary');
    expect(registration?.slice).toBe('meshlibrary');
    expect(registration?.kind).toBe('godot-text');
    expect(resourceSliceRegistry.busTypeFor('MeshLibrary')).toBe('resource');
    expect(registration?.failureLabel).toBe('Resource');
  });

  it('claims no file extension — a .tres is the shared text container', () => {
    expect(resourceSliceRegistry.byTypeName('MeshLibrary')?.extensions).toBeUndefined();
    expect(resourceSliceRegistry.byExtension('.tres')).toBeNull();
  });

  it('is text, so a provider fetches it as a string', () => {
    expect(resourceSliceRegistry.byTypeName('MeshLibrary')?.binaryBytes).toBeFalsy();
  });

  it('does not claim the ArrayMesh its items address', () => {
    // An item's mesh is a Sub-resource path onto its own slice and bus slot, so
    // claiming ArrayMesh here would steal that routing.
    expect(resourceSliceRegistry.byTypeName('ArrayMesh')).toBeNull();
  });

  it('rejects a second slice claiming MeshLibrary', () => {
    expect(() =>
      registerResourceSlice({
        slice: 'not-meshlibrary',
        kind: 'godot-text',
        typeNames: ['MeshLibrary'],
        busType: null,
        failureLabel: 'Impostor',
      })
    ).toThrow(/already claimed by slice "meshlibrary"/);
  });
});
