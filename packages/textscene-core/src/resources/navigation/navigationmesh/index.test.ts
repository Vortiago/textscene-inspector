import { describe, expect, it } from 'vitest';
import * as navigationMeshSlice from './index';
import { resourceSliceRegistry } from '../../sliceRegistration';

// Importing the entry point is what registers the claim; the assertions read the
// registry, never `all()` — that array's contents depend on which other slice
// indexes a given test file happens to pull in.
describe('navigationmesh slice registration', () => {
  it('claims the `NavigationMesh` type name (happy path)', () => {
    const registration = resourceSliceRegistry.byTypeName('NavigationMesh');
    expect(registration?.slice).toBe('navigationmesh');
    expect(registration?.kind).toBe('godot-text');
  });

  it('routes it to the generic resource slot with the Resource failure label', () => {
    // Matches the label `useSubOrExtResource` already passes to `useResource`, so
    // a failed .tres aggregates under the same missing-resources row as before.
    expect(resourceSliceRegistry.busTypeFor('NavigationMesh')).toBe('resource');
    expect(resourceSliceRegistry.byTypeName('NavigationMesh')?.failureLabel).toBe('Resource');
  });

  it('claims no file extension — it arrives inside a .tscn or .tres (edge case)', () => {
    expect(resourceSliceRegistry.byTypeName('NavigationMesh')?.extensions).toBeUndefined();
    expect(resourceSliceRegistry.byTypeName('NavigationMesh')?.binaryBytes).toBeUndefined();
  });

  it('claims the resource, not the region node that holds it (error path)', () => {
    // Asserted against a Node type rather than the 2D sibling resource: a
    // negative on another slice's claim only holds while that slice is out of
    // this test's import closure, which a registration barrel would change.
    expect(resourceSliceRegistry.byTypeName('NavigationRegion3D')).toBeNull();
    expect(resourceSliceRegistry.byTypeName('NavigationLink3D')).toBeNull();
  });

  it('re-exports the decode surface', () => {
    expect(typeof navigationMeshSlice.decodeNavigationMesh).toBe('function');
  });
});
