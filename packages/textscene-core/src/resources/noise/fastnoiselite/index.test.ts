/**
 * The slice's routing claim: a `FastNoiseLite` may ship as a standalone `.tres`,
 * so it rides the generic resource slot rather than being unroutable.
 */
import { describe, expect, it } from 'vitest';
import './index';
import { resourceSliceRegistry } from '../../sliceRegistration';

describe('fastnoiselite slice registration', () => {
  it('claims the FastNoiseLite type name', () => {
    expect(resourceSliceRegistry.byTypeName('FastNoiseLite')).toMatchObject({
      slice: 'fastnoiselite',
      kind: 'godot-text',
      busType: 'resource',
      failureLabel: 'Resource',
    });
  });

  it('routes FastNoiseLite to the resource bus slot', () => {
    expect(resourceSliceRegistry.busTypeFor('FastNoiseLite')).toBe('resource');
  });
});
