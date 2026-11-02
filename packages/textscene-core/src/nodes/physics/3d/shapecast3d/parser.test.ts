import { describe, expect, it } from 'vitest';
import { parseShapeCast3D } from './parser';
import { heading } from '../../../../parser/testing/parserKit';

const cast = heading('ShapeCast3D', { name: 'Cast' });

describe('parseShapeCast3D', () => {
  it('reads target_position on top of the Node3D transform', () => {
    const props = parseShapeCast3D(cast, {
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)',
      target_position: 'Vector3(0, -1, 0)',
    });

    expect(props.target_position).toEqual({ x: 0, y: -1, z: 0 });
    expect(props.transform?.origin).toEqual({ x: 0, y: 1, z: 0 });
    expect(props.name).toBe('Cast');
  });

  it('leaves an unauthored target_position undefined, so the consumer applies the default', () => {
    expect(parseShapeCast3D(cast, {}).target_position).toBeUndefined();
  });

  it('drops an unparseable or non-finite target_position as undefined', () => {
    expect(parseShapeCast3D(cast, { target_position: 'Vector3(nope)' }).target_position).toBeUndefined();
    expect(parseShapeCast3D(cast, { target_position: 'Vector3(inf, 0, 0)' }).target_position).toBeUndefined();
  });

  it('keeps the shape reference string as authored, and leaves it undefined when absent', () => {
    expect(parseShapeCast3D(cast, { shape: 'SubResource("BoxShape3D_1")' }).shape).toBe(
      'SubResource("BoxShape3D_1")'
    );
    expect(parseShapeCast3D(cast, { shape: 'ExtResource("9_shape")' }).shape).toBe('ExtResource("9_shape")');
    expect(parseShapeCast3D(cast, {}).shape).toBeUndefined();
  });

  it('reads debug_shape_custom_color, and leaves it undefined when absent or malformed', () => {
    expect(
      parseShapeCast3D(cast, { debug_shape_custom_color: 'Color(1, 0, 0, 1)' }).debug_shape_custom_color
    ).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    expect(parseShapeCast3D(cast, {}).debug_shape_custom_color).toBeUndefined();
    expect(
      parseShapeCast3D(cast, { debug_shape_custom_color: 'rgb(0, 0, 0)' }).debug_shape_custom_color
    ).toBeUndefined();
  });

  it('reads enabled as written, and leaves it undefined when unauthored', () => {
    expect(parseShapeCast3D(cast, { enabled: 'false' }).enabled).toBe(false);
    expect(parseShapeCast3D(cast, { enabled: '1' }).enabled).toBe(true);
    expect(parseShapeCast3D(cast, {}).enabled).toBeUndefined();
  });
});
