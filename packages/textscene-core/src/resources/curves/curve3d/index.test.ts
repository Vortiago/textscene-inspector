import { describe, expect, it } from 'vitest';
import * as curve3dSlice from './index';
import { resourceSliceRegistry } from '../../sliceRegistration';

// Importing the entry point registers the claim. The assertions read the registry,
// never `all()`, whose contents depend on which slice indexes a test file imports.
describe('curve3d slice registration', () => {
  it('claims the `Curve3D` type name for the curve3d slice (happy path)', () => {
    const registration = resourceSliceRegistry.byTypeName('Curve3D');
    expect(registration?.slice).toBe('curve3d');
    expect(registration?.kind).toBe('godot-text');
  });

  it('routes `Curve3D` to the generic resource slot with the Resource failure label', () => {
    expect(resourceSliceRegistry.busTypeFor('Curve3D')).toBe('resource');
    expect(resourceSliceRegistry.byTypeName('Curve3D')?.failureLabel).toBe('Resource');
  });

  it('claims no file extension — a Curve3D arrives inside a .tscn or .tres (edge case)', () => {
    expect(resourceSliceRegistry.byTypeName('Curve3D')?.extensions).toBeUndefined();
    expect(resourceSliceRegistry.byTypeName('Curve3D')?.binaryBytes).toBeUndefined();
  });

  it('claims the resource, not the node type that holds it (error path)', () => {
    // Asserted against a Node type rather than a sibling resource: a negative on
    // another slice's claim only holds while that slice is out of this test's
    // import closure, which a registration barrel would silently change.
    expect(resourceSliceRegistry.byTypeName('Path3D')).toBeNull();
    expect(resourceSliceRegistry.byTypeName('PathFollow3D')).toBeNull();
  });

  it('re-exports the decode surface', () => {
    expect(typeof curve3dSlice.decodeCurve3D).toBe('function');
    expect(typeof curve3dSlice.tessellateCurve3D).toBe('function');
  });
});
