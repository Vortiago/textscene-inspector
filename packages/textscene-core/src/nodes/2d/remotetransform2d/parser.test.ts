import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { parseRemoteTransform2D } from './parser';

describe('parseRemoteTransform2D', () => {
  it('parses name, parent, and the 2D transform (happy path)', () => {
    const result = parseRemoteTransform2D(
      heading('RemoteTransform2D', { name: 'MyRemoteTransform2D', parent: '.' }),
      { position: 'Vector2(10, 20)', rotation: '0.5' }
    );
    expect(result.name).toBe('MyRemoteTransform2D');
    expect(result.parent).toBe('.');
    expect(result.position).toEqual({ x: 10, y: 20 });
    expect(result.rotation).toBeCloseTo(0.5, 5);
  });

  it('falls back to the identity transform on a malformed transform (error path)', () => {
    const result = parseRemoteTransform2D(
      heading('RemoteTransform2D', { name: 'Bad' }),
      { transform: 'Transform2D(not, valid)' }
    );
    expect(result.position).toEqual({ x: 0, y: 0 });
    expect(result.scale).toEqual({ x: 1, y: 1 });
  });

  it('handles missing optional attributes (edge case)', () => {
    const result = parseRemoteTransform2D({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.parent).toBeUndefined();
    expect(result.position).toEqual({ x: 0, y: 0 });
  });

  it('parses remote_path and the update flags (happy path)', () => {
    const result = parseRemoteTransform2D(heading('RemoteTransform2D', { name: 'CameraAnchor' }), {
      remote_path: 'NodePath("../../Camera2D")',
      update_position: 'false',
      update_rotation: 'false',
      update_scale: 'true',
      use_global_coordinates: 'false',
    });
    expect(result.remote_path).toBe('NodePath("../../Camera2D")');
    expect(result.update_position).toBe(false);
    expect(result.update_rotation).toBe(false);
    expect(result.update_scale).toBe(true);
    expect(result.use_global_coordinates).toBe(false);
  });

  it('leaves RemoteTransform2D-specific properties undefined when absent (edge case)', () => {
    const result = parseRemoteTransform2D(heading('RemoteTransform2D', { name: 'Bare' }), {});
    expect(result.remote_path).toBeUndefined();
    expect(result.update_position).toBeUndefined();
    expect(result.update_rotation).toBeUndefined();
    expect(result.update_scale).toBeUndefined();
    expect(result.use_global_coordinates).toBeUndefined();
  });
});
