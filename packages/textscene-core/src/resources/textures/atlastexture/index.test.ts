/**
 * The slice's routing claim: importing the entry point must register
 * `AtlasTexture`. It claims the `resource` slot rather than `texture` because an
 * AtlasTexture is never a file — only the atlas it names is.
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
