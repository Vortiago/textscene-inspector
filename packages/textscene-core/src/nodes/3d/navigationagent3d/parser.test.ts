import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { parseNavigationAgent3D } from './parser';

describe('parseNavigationAgent3D', () => {
  it('parses name, parent, and transform (happy path)', () => {
    const result = parseNavigationAgent3D(
      heading('NavigationAgent3D', { name: 'MyNavigationAgent3D', parent: '.' }),
      { transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3, 4)' }
    );
    expect(result.name).toBe('MyNavigationAgent3D');
    expect(result.parent).toBe('.');
    expect(result.transform?.origin).toEqual({ x: 2, y: 3, z: 4 });
  });

  it('falls back to identity transform on a malformed transform (error path)', () => {
    const result = parseNavigationAgent3D(
      heading('NavigationAgent3D', { name: 'Bad' }),
      { transform: 'Transform3D(not, valid)' }
    );
    expect(result.transform?.basis_x).toEqual({ x: 1, y: 0, z: 0 });
    expect(result.transform?.origin).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('handles missing optional attributes (edge case)', () => {
    const result = parseNavigationAgent3D({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.parent).toBeUndefined();
    expect(result.transform).toBeUndefined();
  });

  it('parses avoidance and path properties (happy path)', () => {
    const result = parseNavigationAgent3D(heading('NavigationAgent3D', { name: 'Movement' }), {
      radius: '0.75',
      height: '1.8',
      avoidance_enabled: 'true',
      avoidance_layers: '2',
      avoidance_mask: '3',
      max_neighbors: '1',
      max_speed: '5',
      navigation_layers: '4',
      target_desired_distance: '1.5',
      path_desired_distance: '0.5',
      target_position: 'Vector3(1, 2, 3)',
    });
    expect(result.radius).toBe(0.75);
    expect(result.height).toBe(1.8);
    expect(result.avoidance_enabled).toBe(true);
    expect(result.avoidance_layers).toBe(2);
    expect(result.avoidance_mask).toBe(3);
    expect(result.max_neighbors).toBe(1);
    expect(result.max_speed).toBe(5);
    expect(result.navigation_layers).toBe(4);
    expect(result.target_desired_distance).toBe(1.5);
    expect(result.path_desired_distance).toBe(0.5);
    expect(result.target_position).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('leaves NavigationAgent3D-specific properties undefined when absent (edge case)', () => {
    const result = parseNavigationAgent3D(heading('NavigationAgent3D', { name: 'Bare' }), {});
    expect(result.radius).toBeUndefined();
    expect(result.height).toBeUndefined();
    expect(result.avoidance_enabled).toBeUndefined();
    expect(result.max_neighbors).toBeUndefined();
    expect(result.target_position).toBeUndefined();
  });

  it('drops an unparseable target_position rather than throwing (error path)', () => {
    const result = parseNavigationAgent3D(heading('NavigationAgent3D', { name: 'Bad' }), {
      target_position: 'Vector3(nope)',
    });
    expect(result.target_position).toBeUndefined();
  });
});
