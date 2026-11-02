import { describe, expect, it } from 'vitest';
import { heading } from '../../../../parser/testing/parserKit';
import { parseGeneric6DOFJoint3D } from './parser';
import { describeUnsetAndUnreadableKeys } from '../joint3d/jointParserCases.testkit';

const joint = heading('Generic6DOFJoint3D', { name: 'Joint' });

describe('parseGeneric6DOFJoint3D', () => {
  it('reads the limit keys of each axis on top of the Joint3D surface', () => {
    const props = parseGeneric6DOFJoint3D(joint, {
      node_a: 'NodePath("../A")',
      'linear_limit_x/enabled': 'false',
      'linear_limit_x/upper_distance': '1.5',
      'linear_limit_x/lower_distance': '-0.5',
      'angular_limit_y/enabled': 'false',
      'angular_limit_y/upper_angle': '0.8',
      'angular_limit_y/lower_angle': '-0.5',
      'linear_limit_z/upper_distance': '2.0',
      'angular_limit_z/lower_angle': '-1.0471975',
    });

    expect(props.node_a).toBe('../A');
    expect(props['linear_limit_x/enabled']).toBe(false);
    expect(props['linear_limit_x/upper_distance']).toBe(1.5);
    expect(props['linear_limit_x/lower_distance']).toBe(-0.5);
    expect(props['angular_limit_y/enabled']).toBe(false);
    expect(props['angular_limit_y/upper_angle']).toBe(0.8);
    expect(props['angular_limit_y/lower_angle']).toBe(-0.5);
    expect(props['linear_limit_z/upper_distance']).toBe(2);
    expect(props['angular_limit_z/lower_angle']).toBe(-1.0471975);
  });

  it('reads an explicit true and a zero limit, which are not unset', () => {
    const props = parseGeneric6DOFJoint3D(joint, {
      'linear_limit_y/enabled': 'true',
      'angular_limit_x/upper_angle': '0.0',
    });
    expect(props['linear_limit_y/enabled']).toBe(true);
    expect(props['angular_limit_x/upper_angle']).toBe(0);
  });
});

describeUnsetAndUnreadableKeys('Generic6DOFJoint3D', parseGeneric6DOFJoint3D, {
  'linear_limit_x/enabled': 'maybe',
  'linear_limit_y/upper_distance': 'far',
  'linear_limit_z/lower_distance': 'far',
  'angular_limit_x/enabled': 'maybe',
  'angular_limit_y/upper_angle': 'wide',
  'angular_limit_z/lower_angle': 'wide',
});
