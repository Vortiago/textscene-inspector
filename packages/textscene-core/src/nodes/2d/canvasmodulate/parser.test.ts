import { describe, expect, it } from 'vitest';
import { parseCanvasModulate } from './parser';
import { heading } from '../../../parser/testing/parserKit';

describe('parseCanvasModulate', () => {
  it('parses a typed color from Color(...) format', () => {
    const props = parseCanvasModulate(heading('CanvasModulate', { name: 'CM' }), {
      color: 'Color(0.5, 0.75, 0.25, 1)',
    });
    expect(props.color.r).toBeCloseTo(0.5, 5);
    expect(props.color.g).toBeCloseTo(0.75, 5);
    expect(props.color.b).toBeCloseTo(0.25, 5);
    expect(props.color.a).toBe(1);
  });

  it('defaults color to white when omitted', () => {
    const props = parseCanvasModulate(heading('CanvasModulate', { name: 'CM' }), {});
    expect(props.color.r).toBe(1);
    expect(props.color.g).toBe(1);
    expect(props.color.b).toBe(1);
    expect(props.color.a).toBe(1);
  });

  it('falls back to white on invalid color string', () => {
    const props = parseCanvasModulate(heading('CanvasModulate', { name: 'CM' }), {
      color: 'not-a-color',
    });
    expect(props.color.r).toBe(1);
    expect(props.color.g).toBe(1);
    expect(props.color.b).toBe(1);
    expect(props.color.a).toBe(1);
  });

  it('inherits Node2D transform properties', () => {
    const props = parseCanvasModulate(heading('CanvasModulate', { name: 'CM' }), {
      position: 'Vector2(32, 64)',
      scale: 'Vector2(2, 3)',
    });
    expect(props.position).toEqual({ x: 32, y: 64 });
    expect(props.scale).toEqual({ x: 2, y: 3 });
    expect(props.name).toBe('CM');
  });
});
