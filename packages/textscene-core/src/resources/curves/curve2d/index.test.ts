import { describe, expect, it } from 'vitest';
import * as curve2dSlice from './index';
import { resourceSliceRegistry } from '../../sliceRegistration';

// Importing the entry point registers the claim. The assertions read the registry,
// never `all()`, whose contents depend on which slice indexes a test file imports.
describe('curve2d slice registration', () => {
  it('claims the `Curve2D` type name for the curve2d slice (happy path)', () => {
    const registration = resourceSliceRegistry.byTypeName('Curve2D');
    expect(registration?.slice).toBe('curve2d');
    expect(registration?.kind).toBe('godot-text');
  });

  it('routes `Curve2D` to the generic resource slot with the Resource failure label', () => {
    expect(resourceSliceRegistry.busTypeFor('Curve2D')).toBe('resource');
    expect(resourceSliceRegistry.byTypeName('Curve2D')?.failureLabel).toBe('Resource');
  });

  it('claims no file extension — a Curve2D arrives inside a .tscn or .tres (edge case)', () => {
    expect(resourceSliceRegistry.byTypeName('Curve2D')?.extensions).toBeUndefined();
    expect(resourceSliceRegistry.byTypeName('Curve2D')?.binaryBytes).toBeUndefined();
  });

  it('claims the resource, not the node type that holds it (error path)', () => {
    // Asserted against a Node type rather than a sibling resource: a negative on
    // another slice's claim only holds while that slice is out of this test's
    // import closure, which a registration barrel would silently change.
    expect(resourceSliceRegistry.byTypeName('Path2D')).toBeNull();
    expect(resourceSliceRegistry.byTypeName('PathFollow2D')).toBeNull();
  });

  it('re-exports the decode surface', () => {
    expect(typeof curve2dSlice.parseCurve2DPoints).toBe('function');
    expect(typeof curve2dSlice.tessellateCurve2D).toBe('function');
  });
});
