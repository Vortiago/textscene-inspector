import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseGraphEdit } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseGraphEdit', () => {
  it('parses scroll_offset, zoom, show_grid, grid_pattern, snapping_distance', () => {
    const p = parseGraphEdit(h({ name: 'G', type: 'GraphEdit' }), {
      scroll_offset: 'Vector2(10, 20)',
      zoom: '1.5',
      show_grid: 'false',
      grid_pattern: '1',
      snapping_distance: '25',
    });
    expect(p.scrollOffset).toEqual({ x: 10, y: 20 });
    expect(p.zoom).toBe(1.5);
    expect(p.showGrid).toBe(false);
    expect(p.gridPattern).toBe(1);
    expect(p.snappingDistance).toBe(25);
  });

  it('leaves every member undefined when absent', () => {
    const p = parseGraphEdit(h({ name: 'G', type: 'GraphEdit' }), {});
    expect(p.scrollOffset).toBeUndefined();
    expect(p.zoom).toBeUndefined();
    expect(p.showGrid).toBeUndefined();
    expect(p.gridPattern).toBeUndefined();
    expect(p.snappingDistance).toBeUndefined();
  });
});
