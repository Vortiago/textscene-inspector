/**
 * The TileSet slice's routing claims (ADR-0031). Importing the index registers
 * them; these assertions are what a router reads back out.
 */

import { describe, expect, it } from 'vitest';
import { registerResourceSlice, resourceSliceRegistry } from '../sliceRegistration';
import './index';

describe('tileset slice registration', () => {
  it('claims TileSet for the generic resource bus slot', () => {
    const registration = resourceSliceRegistry.byTypeName('TileSet');
    expect(registration?.slice).toBe('tileset');
    expect(registration?.kind).toBe('godot-text');
    expect(resourceSliceRegistry.busTypeFor('TileSet')).toBe('resource');
    expect(registration?.failureLabel).toBe('Resource');
  });

  it('claims no file extension — a .tres is the shared text container', () => {
    expect(resourceSliceRegistry.byTypeName('TileSet')?.extensions).toBeUndefined();
    expect(resourceSliceRegistry.byExtension('.tres')).toBeNull();
  });

  it('is text, so a provider fetches it as a string', () => {
    expect(resourceSliceRegistry.byTypeName('TileSet')?.binaryBytes).toBeFalsy();
  });

  it('does not claim the source types that only ever arrive nested', () => {
    // TileSetAtlasSource appears solely as a `[sub_resource]` inside a TileSet
    // (no `ext_resource type="TileSetAtlasSource"` exists in the corpus), so a
    // claim would advertise routing for a file that is never fetched.
    expect(resourceSliceRegistry.byTypeName('TileSetAtlasSource')).toBeNull();
    expect(resourceSliceRegistry.byTypeName('TileSetScenesCollectionSource')).toBeNull();
  });

  it('rejects a second slice claiming TileSet', () => {
    expect(() =>
      registerResourceSlice({
        slice: 'not-tileset',
        kind: 'godot-text',
        typeNames: ['TileSet'],
        busType: null,
        failureLabel: 'Impostor',
      })
    ).toThrow(/already claimed by slice "tileset"/);
  });
});
