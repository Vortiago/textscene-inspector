import { describe, expect, it } from 'vitest';
import { gridCellMinimumExtent } from './gridCellMinimum';

describe('gridCellMinimumExtent', () => {
  it('drops the fraction of a child minimum, as the int column does (grid_container.cpp:290-291)', () => {
    expect(gridCellMinimumExtent(86.74)).toBe(86);
    expect(gridCellMinimumExtent(40)).toBe(40);
  });
});
