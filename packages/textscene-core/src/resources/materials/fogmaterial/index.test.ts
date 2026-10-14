/** The slice's routing claim, for a FogMaterial in its own `.tres`. */
import { describe, expect, it } from 'vitest';
import './index';
import { resourceSliceRegistry } from '../../sliceRegistration';

describe('fogmaterial slice registration', () => {
  it('routes FogMaterial to the resource bus slot', () => {
    expect(resourceSliceRegistry.byTypeName('FogMaterial')).toMatchObject({
      slice: 'fogmaterial',
      kind: 'godot-text',
      busType: 'resource',
    });
  });
});
