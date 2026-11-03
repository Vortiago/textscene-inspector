/**
 * The slice's routing claim: a CanvasTexture is Godot text on the `resource` bus, inline or saved as
 * its own `.tres`. Only the textures it names are images.
 */
import { describe, it, expect } from 'vitest';
import './index';
import { resourceSliceRegistry } from '../../sliceRegistration';

describe('canvastexture slice registration', () => {
  it('claims the CanvasTexture type name on the resource bus', () => {
    expect(resourceSliceRegistry.byTypeName('CanvasTexture')).toMatchObject({
      slice: 'canvastexture',
      kind: 'godot-text',
      busType: 'resource',
    });
  });
});
