import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { parseNavigationObstacle3D } from './parser';

describe('parseNavigationObstacle3D', () => {
  it('parses name, parent, and transform (happy path)', () => {
    const result = parseNavigationObstacle3D(
      heading('NavigationObstacle3D', { name: 'MyNavigationObstacle3D', parent: '.' }),
      { transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3, 4)' }
    );
    expect(result.name).toBe('MyNavigationObstacle3D');
    expect(result.parent).toBe('.');
    expect(result.transform?.origin).toEqual({ x: 2, y: 3, z: 4 });
  });

  it('falls back to identity transform on a malformed transform (error path)', () => {
    const result = parseNavigationObstacle3D(
      heading('NavigationObstacle3D', { name: 'Bad' }),
      { transform: 'Transform3D(not, valid)' }
    );
    expect(result.transform?.basis_x).toEqual({ x: 1, y: 0, z: 0 });
    expect(result.transform?.origin).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('handles missing optional attributes (edge case)', () => {
    const result = parseNavigationObstacle3D({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.parent).toBeUndefined();
    expect(result.transform).toBeUndefined();
  });

  it('parses radius/height/avoidance properties (happy path)', () => {
    const result = parseNavigationObstacle3D(heading('NavigationObstacle3D', { name: 'MovementObstacle' }), {
      radius: '1.5',
      height: '2.0',
      avoidance_enabled: 'true',
      avoidance_layers: '2',
      affect_navigation_mesh: 'true',
      carve_navigation_mesh: 'true',
      use_3d_avoidance: 'true',
    });
    expect(result.radius).toBe(1.5);
    expect(result.height).toBe(2.0);
    expect(result.avoidance_enabled).toBe(true);
    expect(result.avoidance_layers).toBe(2);
    expect(result.affect_navigation_mesh).toBe(true);
    expect(result.carve_navigation_mesh).toBe(true);
    expect(result.use_3d_avoidance).toBe(true);
  });

  it('leaves NavigationObstacle3D-specific properties undefined when absent (edge case)', () => {
    const result = parseNavigationObstacle3D(heading('NavigationObstacle3D', { name: 'Bare' }), {});
    expect(result.radius).toBeUndefined();
    expect(result.height).toBeUndefined();
    expect(result.avoidance_enabled).toBeUndefined();
    expect(result.affect_navigation_mesh).toBeUndefined();
  });
});
