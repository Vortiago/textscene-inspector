/**
 * The LightmapGIData slice's routing claims (ADR-0031). Importing the index registers them, and
 * these assertions are what a router reads back out.
 */

import { describe, expect, it } from 'vitest';
import { registerResourceSlice, resourceSliceRegistry } from '../sliceRegistration';
import './index';

describe('lightmapgidata slice registration', () => {
  it('claims LightmapGIData for the generic resource bus slot, as Godot text', () => {
    const registration = resourceSliceRegistry.byTypeName('LightmapGIData');
    expect(registration?.slice).toBe('lightmapgidata');
    expect(registration?.kind).toBe('godot-text');
    expect(registration?.busType).toBe('resource');
  });

  it('claims no extension: the binary container slice claims .lmbake', () => {
    expect(resourceSliceRegistry.byTypeName('LightmapGIData')?.extensions).toBeUndefined();
  });

  it('rejects a second slice claiming LightmapGIData', () => {
    expect(() =>
      registerResourceSlice({
        slice: 'not-lightmapgidata',
        kind: 'godot-text',
        typeNames: ['LightmapGIData'],
        busType: null,
      })
    ).toThrow(/already claimed by slice "lightmapgidata"/);
  });
});
