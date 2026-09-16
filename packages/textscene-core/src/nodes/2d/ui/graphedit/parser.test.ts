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

  it('parses connection_lines_curvature, connection_lines_thickness and connections', () => {
    const p = parseGraphEdit(h({ name: 'G', type: 'GraphEdit' }), {
      connection_lines_curvature: '0.25',
      connection_lines_thickness: '6.0',
      connections: '[{ "from_node": &"Source", "from_port": 0, "to_node": &"Sink", "to_port": 0 }]',
    });
    expect(p.connectionLinesCurvature).toBe(0.25);
    expect(p.connectionLinesThickness).toBe(6.0);
    expect(p.connections).toEqual([{ fromNode: 'Source', fromPort: 0, toNode: 'Sink', toPort: 0 }]);
  });

  it('parses the minimap family and every toolbar visibility flag', () => {
    const p = parseGraphEdit(h({ name: 'G', type: 'GraphEdit' }), {
      minimap_enabled: 'false',
      minimap_size: 'Vector2(200, 120)',
      minimap_opacity: '0.4',
      show_menu: 'false',
      show_zoom_label: 'true',
      show_zoom_buttons: 'false',
      show_grid_buttons: 'false',
      show_minimap_button: 'false',
      show_arrange_button: 'false',
      snapping_enabled: 'false',
    });
    expect(p.minimapEnabled).toBe(false);
    expect(p.minimapSize).toEqual({ x: 200, y: 120 });
    expect(p.minimapOpacity).toBe(0.4);
    expect(p.showMenu).toBe(false);
    expect(p.showZoomLabel).toBe(true);
    expect(p.showZoomButtons).toBe(false);
    expect(p.showGridButtons).toBe(false);
    expect(p.showMinimapButton).toBe(false);
    expect(p.showArrangeButton).toBe(false);
    expect(p.snappingEnabled).toBe(false);
  });

  it('leaves every member undefined (connections empty) when absent', () => {
    const p = parseGraphEdit(h({ name: 'G', type: 'GraphEdit' }), {});
    expect(p.scrollOffset).toBeUndefined();
    expect(p.zoom).toBeUndefined();
    expect(p.showGrid).toBeUndefined();
    expect(p.gridPattern).toBeUndefined();
    expect(p.snappingDistance).toBeUndefined();
    expect(p.connectionLinesCurvature).toBeUndefined();
    expect(p.connectionLinesThickness).toBeUndefined();
    expect(p.connections).toEqual([]);
    expect(p.minimapEnabled).toBeUndefined();
    expect(p.minimapSize).toBeUndefined();
    expect(p.minimapOpacity).toBeUndefined();
    expect(p.showMenu).toBeUndefined();
    expect(p.showZoomLabel).toBeUndefined();
    expect(p.showZoomButtons).toBeUndefined();
    expect(p.showGridButtons).toBeUndefined();
    expect(p.showMinimapButton).toBeUndefined();
    expect(p.showArrangeButton).toBeUndefined();
    expect(p.snappingEnabled).toBeUndefined();
  });
});
