import { describe, expect, it } from 'vitest';
import { heading } from '../../../../parser/testing/parserKit';
import { parseSliderJoint3D } from './parser';

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

  it('leaves unauthored keys undefined, so the consumer applies Godot defaults', () => {
    const props = parseSliderJoint3D(slider, {});
    expect(props['linear_limit/upper_distance']).toBeUndefined();
    expect(props['angular_limit/lower_angle']).toBeUndefined();
  });

  it('keeps a zero limit and reads an unreadable one as undefined, not NaN', () => {
    const props = parseSliderJoint3D(slider, {
      'linear_limit/upper_distance': '0.0',
      'linear_limit/lower_distance': 'far',
    });
    expect(props['linear_limit/upper_distance']).toBe(0);
    expect(props['linear_limit/lower_distance']).toBeUndefined();
  });
});
