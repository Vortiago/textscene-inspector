/**
 * The slice's routing claim: `ViewportTexture` is registered but unroutable,
 * since it resolves by NodePath, never by file.
 */
import { describe, it, expect } from 'vitest';
import './index';
import { resourceSliceRegistry } from '../../sliceRegistration';

describe('viewporttexture slice registration', () => {
  it('claims the ViewportTexture type name', () => {
    expect(resourceSliceRegistry.byTypeName('ViewportTexture')).toMatchObject({
      slice: 'viewporttexture',
      kind: 'godot-text',
      busType: null,
    });
  });

  it('routes to NO bus slot — the loader never fetches a file for it', () => {
    expect(resourceSliceRegistry.byTypeName('ViewportTexture')?.busType ?? null).toBeNull();
  });

  it('is distinguishable from an unclaimed type by the claim itself, not by its bus', () => {
    // Neither has a bus, so only the claim itself tells a ViewportTexture from an
    // unsupported type.
    expect(resourceSliceRegistry.byTypeName('NotARealResourceType')).toBeNull();
    expect(resourceSliceRegistry.byTypeName('ViewportTexture')).not.toBeNull();
  });
});
