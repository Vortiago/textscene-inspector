import { describe, expect, it } from 'vitest';
import { parsePath2D } from './parser';
import type { ParsedHeading } from '../../../parser/utils';

function heading(name = 'MyPath'): ParsedHeading {
  return { type: 'node', attributes: { type: 'Path2D', name } };
}

describe('parsePath2D', () => {
  it('captures the raw curve reference and inherits the Node2D transform', () => {
    const props = parsePath2D(heading(), {
      curve: 'SubResource("Curve2D_1")',
      position: 'Vector2(0, 88)',
    });
    expect(props.curve).toBe('SubResource("Curve2D_1")');
    expect(props.position).toEqual({ x: 0, y: 88 });
  });

  it('leaves curve undefined when absent (edge: runtime-assigned curve)', () => {
    const props = parsePath2D(heading(), {});
    expect(props.curve).toBeUndefined();
    expect(props.position).toEqual({ x: 0, y: 0 });
  });
});
