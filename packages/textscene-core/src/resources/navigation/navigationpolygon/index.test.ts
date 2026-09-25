import { describe, expect, it } from 'vitest';
import * as navigationPolygonSlice from './index';
import { resourceSliceRegistry } from '../../sliceRegistration';

// Importing the entry point registers the claim. The assertions read the
// registry, never `all()`, whose contents depend on which other slice indexes
// a test file pulls in.
describe('navigationpolygon slice registration', () => {
  it('claims the `NavigationPolygon` type name (happy path)', () => {
    const registration = resourceSliceRegistry.byTypeName('NavigationPolygon');
    expect(registration?.slice).toBe('navigationpolygon');
    expect(registration?.kind).toBe('godot-text');
  });

  it('routes it to the generic resource slot with the Resource failure label', () => {
    // Matches the label `useSubOrExtResource` passes to `useResource`, so a
    // failed .tres aggregates under the same missing-resources row.
    expect(resourceSliceRegistry.busTypeFor('NavigationPolygon')).toBe('resource');
    expect(resourceSliceRegistry.byTypeName('NavigationPolygon')?.failureLabel).toBe(
      'Resource'
    );
  });

  it('claims no file extension — it arrives inside a .tscn or .tres (edge case)', () => {
    expect(resourceSliceRegistry.byTypeName('NavigationPolygon')?.extensions).toBeUndefined();
    expect(
      resourceSliceRegistry.byTypeName('NavigationPolygon')?.binaryBytes
    ).toBeUndefined();
  });

  it('claims the resource, not the region node that holds it (error path)', () => {
    // Asserted against a Node type rather than the 3D sibling resource: a
    // negative on another slice's claim only holds while that slice is out of
    // this test's import closure, which a registration barrel would change.
    expect(resourceSliceRegistry.byTypeName('NavigationRegion2D')).toBeNull();
    expect(resourceSliceRegistry.byTypeName('NavigationLink2D')).toBeNull();
  });

  it('re-exports the decode surface', () => {
    expect(typeof navigationPolygonSlice.decodeNavigationPolygon).toBe('function');
  });
});
