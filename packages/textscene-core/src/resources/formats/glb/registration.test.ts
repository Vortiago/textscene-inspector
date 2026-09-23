/**
 * The GLB slice's routing claims (ADR-0031). Importing the index registers them, and
 * these assertions are what a router and `resourceProviderUtils` read back out.
 */

import { describe, expect, it } from 'vitest';
import { registerResourceSlice, resourceSliceRegistry } from '../../sliceRegistration';
import './index';

describe('glb slice registration', () => {
  it('claims the GLB type names for the glb bus slot', () => {
    for (const typeName of ['GLB', 'GLTF', 'GLBMesh']) {
      const registration = resourceSliceRegistry.byTypeName(typeName);
      expect(registration?.slice).toBe('glb');
      expect(registration?.kind).toBe('foreign-format');
      expect(resourceSliceRegistry.busTypeFor(typeName)).toBe('glb');
    }
  });

  it('claims .glb and .gltf as files fetched as bytes', () => {
    for (const extension of ['.glb', '.gltf']) {
      const registration = resourceSliceRegistry.byExtension(extension);
      expect(registration?.slice).toBe('glb');
      expect(registration?.binaryBytes).toBe(true);
    }
  });

  it('labels a failed load the way the missing-resources panel reads it', () => {
    expect(resourceSliceRegistry.byTypeName('GLB')?.failureLabel).toBe('Node using GLB mesh');
  });

  it('claims extensions dot-prefixed, so a bare suffix is not a claim', () => {
    // The normalisation contract every extension consumer depends on.
    expect(resourceSliceRegistry.byExtension('glb')).toBeNull();
    expect(resourceSliceRegistry.byExtension('.GLB')).toBeNull();
  });

  it('leaves a type no slice claims unrouted', () => {
    expect(resourceSliceRegistry.byTypeName('PackedScene')).toBeNull();
    expect(resourceSliceRegistry.busTypeFor('PackedScene')).toBeNull();
  });

  it('rejects a second slice claiming GLB', () => {
    expect(() =>
      registerResourceSlice({
        slice: 'not-glb',
        kind: 'foreign-format',
        typeNames: ['GLB'],
        busType: null,
        failureLabel: 'Impostor',
      })
    ).toThrow(/already claimed by slice "glb"/);
  });
});
