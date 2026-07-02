import { describe, expect, it } from 'vitest';
import { parsePath3D } from './parser';
import { heading } from '../../../parser/testing/parserKit';

describe('parsePath3D', () => {
  it('captures the raw curve reference and inherits the Node3D transform', () => {
    const props = parsePath3D(heading('Path3D', { name: 'MyPath' }), {
      curve: 'SubResource("Curve3D_1")',
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 5, 0)',
    });
    expect(props.curve).toBe('SubResource("Curve3D_1")');
    expect(props.transform?.origin).toEqual({ x: 0, y: 5, z: 0 });
  });

  it('leaves curve undefined when absent (edge: runtime-assigned curve)', () => {
    const props = parsePath3D(heading('Path3D', { name: 'MyPath' }), {});
    expect(props.curve).toBeUndefined();
  });
});
