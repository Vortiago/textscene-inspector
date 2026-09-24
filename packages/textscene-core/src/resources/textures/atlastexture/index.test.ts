/**
 * The slice's routing claim: importing the entry point registers `AtlasTexture`
 * on the `resource` slot, not `texture`. An AtlasTexture's own bytes are
 * Godot-text. Only the atlas it names is an image.
 */
import { describe, it, expect } from 'vitest';
import './index';
import { resourceSliceRegistry } from '../../sliceRegistration';

describe('atlastexture slice registration', () => {
  it('claims the AtlasTexture type name', () => {
    expect(resourceSliceRegistry.byTypeName('AtlasTexture')).toMatchObject({
      slice: 'atlastexture',
      kind: 'godot-text',
      busType: 'resource',
      failureLabel: 'Resource',
    });
  });

  it('routes AtlasTexture to the resource bus slot', () => {
    expect(resourceSliceRegistry.busTypeFor('AtlasTexture')).toBe('resource');
  });

  it('claims no file extension — an AtlasTexture is always a sub-resource', () => {
    expect(resourceSliceRegistry.byTypeName('AtlasTexture')!.extensions).toBeUndefined();
  });
});
