import { describe, expect, it } from 'vitest';
import { heading } from '../../../../parser/testing/parserKit';
import { parseSliderJoint3D } from './parser';
import { describeUnsetAndUnreadableKeys } from '../joint3d/jointParserCases.testkit';

const slider = heading('SliderJoint3D', { name: 'Slider' });

describe('parseSliderJoint3D', () => {
  it('reads the linear distances and angular limits on top of the Joint3D surface', () => {
    const props = parseSliderJoint3D(slider, {
      node_a: 'NodePath("../A")',
      'linear_limit/upper_distance': '0.5',
      'linear_limit/lower_distance': '-2.0',
      'angular_limit/upper_angle': '0.8',
      'angular_limit/lower_angle': '-0.5',
    });

    expect(props['linear_limit/upper_distance']).toBe(0.5);
    expect(props['linear_limit/lower_distance']).toBe(-2);
    expect(props['angular_limit/upper_angle']).toBe(0.8);
    expect(props['angular_limit/lower_angle']).toBe(-0.5);
    expect(props.node_a).toBe('../A');
  });

  it('keeps a zero limit', () => {
    expect(
      parseSliderJoint3D(slider, { 'linear_limit/upper_distance': '0.0' })['linear_limit/upper_distance']
    ).toBe(0);
  });
});

describeUnsetAndUnreadableKeys('SliderJoint3D', parseSliderJoint3D, {
  'linear_limit/upper_distance': 'far',
  'linear_limit/lower_distance': 'far',
  'angular_limit/upper_angle': 'far',
  'angular_limit/lower_angle': 'far',
});
