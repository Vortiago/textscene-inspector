import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { parseRemoteTransform3D } from './parser';

describe('parseRemoteTransform3D', () => {
  it('parses name, parent, and transform (happy path)', () => {
    const result = parseRemoteTransform3D(
      heading('RemoteTransform3D', { name: 'MyRemoteTransform3D', parent: '.' }),
      { transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3, 4)' }
    );
    expect(result.name).toBe('MyRemoteTransform3D');
    expect(result.parent).toBe('.');
    expect(result.transform?.origin).toEqual({ x: 2, y: 3, z: 4 });
  });

  it('falls back to identity transform on a malformed transform (error path)', () => {
    const result = parseRemoteTransform3D(
      heading('RemoteTransform3D', { name: 'Bad' }),
      { transform: 'Transform3D(not, valid)' }
    );
    expect(result.transform?.basis_x).toEqual({ x: 1, y: 0, z: 0 });
    expect(result.transform?.origin).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('handles missing optional attributes (edge case)', () => {
    const result = parseRemoteTransform3D({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.parent).toBeUndefined();
    expect(result.transform).toBeUndefined();
  });

  it('parses remote_path and the update flags (happy path)', () => {
    const result = parseRemoteTransform3D(heading('RemoteTransform3D', { name: 'PositionSynchronizer' }), {
      remote_path: 'NodePath("../DetachTransform/Geometry")',
      update_position: 'true',
      update_rotation: 'false',
      update_scale: 'false',
      use_global_coordinates: 'false',
    });
    expect(result.remote_path).toBe('NodePath("../DetachTransform/Geometry")');
    expect(result.update_position).toBe(true);
    expect(result.update_rotation).toBe(false);
    expect(result.update_scale).toBe(false);
    expect(result.use_global_coordinates).toBe(false);
  });

  it('leaves RemoteTransform3D-specific properties undefined when absent (edge case)', () => {
    const result = parseRemoteTransform3D(heading('RemoteTransform3D', { name: 'Bare' }), {});
    expect(result.remote_path).toBeUndefined();
    expect(result.update_position).toBeUndefined();
    expect(result.update_rotation).toBeUndefined();
    expect(result.update_scale).toBeUndefined();
    expect(result.use_global_coordinates).toBeUndefined();
  });
});
