import { describe, expect, it } from 'vitest';
import { orderedCategories } from './categoryOrder.mjs';

describe('orderedCategories', () => {
  it('puts the listed categories in their order', () => {
    expect(orderedCategories(['Other', '2D', 'Resources', '3D'])).toEqual(['3D', '2D', 'Resources', 'Other']);
  });

  it('puts an unlisted category after the listed ones, A to Z', () => {
    expect(orderedCategories(['XR', '3D', 'Audio'])).toEqual(['3D', 'Audio', 'XR']);
  });
});
