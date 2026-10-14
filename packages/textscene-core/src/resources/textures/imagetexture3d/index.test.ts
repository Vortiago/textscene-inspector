/** The imagetexture3d slice's routing claim (ADR-0031). */
import { describe, expect, it } from 'vitest';
import { resourceSliceRegistry } from '../../sliceRegistration';
import './index';

describe('imagetexture3d slice registration', () => {
  it('claims ImageTexture3D for the resource bus slot, since its pixels are text', () => {
    const registration = resourceSliceRegistry.byTypeName('ImageTexture3D');
    expect(registration?.slice).toBe('imagetexture3d');
    expect(registration?.kind).toBe('godot-text');
    expect(registration?.busType).toBe('resource');
  });

  it('claims no file extension, since a .tres is any text resource (edge case)', () => {
    expect(resourceSliceRegistry.all().find((r) => r.slice === 'imagetexture3d')?.extensions).toBeUndefined();
  });
});
