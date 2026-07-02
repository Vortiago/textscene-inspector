import { describe, expect, it } from 'vitest';
import { parseMarker2D } from './parser';
import { heading } from '../../../parser/testing/parserKit';

describe('parseMarker2D', () => {
  it('defaults gizmo_extents to 10 and inherits the Node2D transform', () => {
    const props = parseMarker2D(heading('Marker2D', { name: 'MyMarker' }), {
      position: 'Vector2(32, 64)',
    });
    expect(props.gizmo_extents).toBe(10);
    expect(props.position).toEqual({ x: 32, y: 64 });
    expect(props.name).toBe('MyMarker');
  });

  it('reads an explicit gizmo_extents', () => {
    const props = parseMarker2D(heading('Marker2D', { name: 'MyMarker' }), {
      gizmo_extents: '25.5',
    });
    expect(props.gizmo_extents).toBeCloseTo(25.5, 5);
  });

  it('falls back to default position/scale when none given (edge: bare node)', () => {
    const props = parseMarker2D(heading('Marker2D', { name: 'MyMarker' }), {});
    expect(props.position).toEqual({ x: 0, y: 0 });
    expect(props.scale).toEqual({ x: 1, y: 1 });
    expect(props.gizmo_extents).toBe(10);
  });

  it('tolerates a non-numeric gizmo_extents (edge) → default', () => {
    const props = parseMarker2D(heading('Marker2D', { name: 'MyMarker' }), {
      gizmo_extents: 'not-a-number',
    });
    expect(props.gizmo_extents).toBe(10);
  });
});
