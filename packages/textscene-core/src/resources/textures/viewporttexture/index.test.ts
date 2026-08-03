/**
 * The slice's routing claim: `ViewportTexture` is REGISTERED but explicitly
 * unroutable — it resolves by NodePath, never by file.
 */
import { describe, it, expect } from 'vitest';
import './index';
import { resourceSliceRegistry } from '../../sliceRegistration';

describe('viewporttexture slice registration', () => {
  it('claims the ViewportTexture type name with its own failure label', () => {
    expect(resourceSliceRegistry.byTypeName('ViewportTexture')).toMatchObject({
      slice: 'viewporttexture',
      kind: 'godot-text',
      busType: null,
      failureLabel: 'Viewport texture',
    });
  });

  it('routes to NO bus slot — the loader never fetches a file for it', () => {
    expect(resourceSliceRegistry.busTypeFor('ViewportTexture')).toBeNull();
  });

  it('is distinguishable from an unclaimed type by the claim itself, not by its bus', () => {
    // `busTypeFor` collapses "registered, unroutable" and "unknown type" to null,
    // so a router must consult `byTypeName` to tell a ViewportTexture (skip the
    // load, it is fine) from a genuinely unsupported type.
    expect(resourceSliceRegistry.byTypeName('NotARealResourceType')).toBeNull();
    expect(resourceSliceRegistry.byTypeName('ViewportTexture')).not.toBeNull();
  });
});
