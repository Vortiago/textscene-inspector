import { describe, expect, it } from 'vitest';
import { parseMarker3D } from './parser';
import { heading } from '../../../parser/testing/parserKit';

describe('parseMarker3D', () => {
  it('defaults gizmo_extents to 0.25 and inherits the Node3D transform', () => {
    const props = parseMarker3D(heading('Marker3D', { name: 'MyMarker' }), {
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 2, 3)',
    });
    expect(props.gizmo_extents).toBeCloseTo(0.25, 5);
    expect(props.transform?.origin).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('reads an explicit gizmo_extents', () => {
    const props = parseMarker3D(heading('Marker3D', { name: 'MyMarker' }), {
      gizmo_extents: '1.5',
    });
    expect(props.gizmo_extents).toBeCloseTo(1.5, 5);
  });

  it('tolerates a non-numeric gizmo_extents (edge) → default', () => {
    const props = parseMarker3D(heading('Marker3D', { name: 'MyMarker' }), {
      gizmo_extents: 'nope',
    });
    expect(props.gizmo_extents).toBeCloseTo(0.25, 5);
  });
});
