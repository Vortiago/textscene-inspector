/** The slice's routing claim, for a ParticleProcessMaterial in its own `.tres`. */
import { describe, expect, it } from 'vitest';
import './index';
import { resourceSliceRegistry } from '../../sliceRegistration';

describe('particleprocessmaterial slice registration', () => {
  it('routes ParticleProcessMaterial to the resource bus slot', () => {
    expect(resourceSliceRegistry.byTypeName('ParticleProcessMaterial')).toMatchObject({
      slice: 'particleprocessmaterial',
      kind: 'godot-text',
      busType: 'resource',
    });
  });
});
