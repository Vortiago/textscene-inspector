import { describe, it, expect } from 'vitest';
import { invertedRangeWindowMessage, LAYER_WINDOW, Z_WINDOW } from './invertedRangeWindow';

describe('invertedRangeWindowMessage', () => {
  it('names the type, both bounds and what the light reaches', () => {
    const message = invertedRangeWindowMessage(
      'PointLight2D',
      { range_z_min: '5', range_z_max: '4' },
      Z_WINDOW
    );

    expect(message).toContain("PointLight2D 'range_z_min' (5) is above 'range_z_max' (4)");
    expect(message).toContain(Z_WINDOW.reaches);
  });

  it('compares an authored bound against the absent half default', () => {
    expect(
      invertedRangeWindowMessage('DirectionalLight2D', { range_layer_min: '1' }, LAYER_WINDOW)
    ).not.toBeNull();
  });

  it('says nothing for an equal pair or a malformed bound', () => {
    expect(invertedRangeWindowMessage('PointLight2D', { range_layer_min: '0' }, LAYER_WINDOW)).toBeNull();
    expect(invertedRangeWindowMessage('PointLight2D', { range_z_min: '"five"' }, Z_WINDOW)).toBeNull();
  });
});
