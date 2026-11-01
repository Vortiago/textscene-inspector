import { describe, expect, it } from 'vitest';
import { parseConeTwistJoint3D } from './parser';
import { heading } from '../../../../parser/testing/parserKit';

const cone = heading('ConeTwistJoint3D', { name: 'Cone' });

describe('parseConeTwistJoint3D', () => {
  it('reads the spans in radians on top of the Joint3D surface', () => {
    const props = parseConeTwistJoint3D(cone, {
      node_a: 'NodePath("../A")',
      swing_span: '0.5236',
      twist_span: '13.0',
    });

    expect(props.swing_span).toBe(0.5236);
    expect(props.twist_span).toBe(13);
    expect(props.node_a).toBe('../A');
  });

  it('leaves unauthored spans undefined, so the consumer applies Godot defaults', () => {
    const props = parseConeTwistJoint3D(cone, {});
    expect(props.swing_span).toBeUndefined();
    expect(props.twist_span).toBeUndefined();
  });

  it('keeps zero and negative spans', () => {
    const props = parseConeTwistJoint3D(cone, { swing_span: '0.0', twist_span: '-1.0' });
    expect(props.swing_span).toBe(0);
    expect(props.twist_span).toBe(-1);
  });

  it('reads an unreadable span as undefined, not NaN', () => {
    expect(parseConeTwistJoint3D(cone, { swing_span: 'wide' }).swing_span).toBeUndefined();
  });
});
