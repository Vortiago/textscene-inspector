import { describe, expect, it } from 'vitest';
import { heading } from '../../../../parser/testing/parserKit';
import { parseHingeJoint3D } from './parser';

const hinge = heading('HingeJoint3D', { name: 'Hinge' });

describe('parseHingeJoint3D', () => {
  it('reads the limit keys in radians on top of the Joint3D surface', () => {
    const props = parseHingeJoint3D(hinge, {
      node_b: 'NodePath("../B")',
      'angular_limit/enable': 'true',
      'angular_limit/lower': '-1.0471975',
      'angular_limit/upper': '0.5',
    });

    expect(props['angular_limit/enable']).toBe(true);
    expect(props['angular_limit/lower']).toBe(-1.0471975);
    expect(props['angular_limit/upper']).toBe(0.5);
    expect(props.node_b).toBe('../B');
  });

  it('leaves unauthored keys undefined, so the consumer applies Godot defaults', () => {
    const props = parseHingeJoint3D(hinge, {});
    expect(props['angular_limit/enable']).toBeUndefined();
    expect(props['angular_limit/lower']).toBeUndefined();
    expect(props['angular_limit/upper']).toBeUndefined();
  });

  it('reads an explicit false and a zero limit, which are not unset', () => {
    const props = parseHingeJoint3D(hinge, { 'angular_limit/enable': 'false', 'angular_limit/upper': '0.0' });
    expect(props['angular_limit/enable']).toBe(false);
    expect(props['angular_limit/upper']).toBe(0);
  });

  it('reads an unreadable key as undefined, not NaN', () => {
    const props = parseHingeJoint3D(hinge, {
      'angular_limit/enable': 'maybe',
      'angular_limit/lower': 'wide',
    });
    expect(props['angular_limit/enable']).toBeUndefined();
    expect(props['angular_limit/lower']).toBeUndefined();
  });
});
