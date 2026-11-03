import { describe, expect, it } from 'vitest';
import { parseRayCast3D } from './parser';
import { heading } from '../../../../parser/testing/parserKit';

const ray = heading('RayCast3D', { name: 'Ray' });

describe('parseRayCast3D', () => {
  it('reads target_position on top of the Node3D transform', () => {
    const props = parseRayCast3D(ray, {
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)',
      target_position: 'Vector3(0, -3, 0)',
    });

    expect(props.target_position).toEqual({ x: 0, y: -3, z: 0 });
    expect(props.transform?.origin).toEqual({ x: 0, y: 1, z: 0 });
    expect(props.name).toBe('Ray');
  });

  it('keeps a negative, fractional and zero target_position', () => {
    expect(parseRayCast3D(ray, { target_position: 'Vector3(-2, 3.5, 0)' }).target_position).toEqual({
      x: -2,
      y: 3.5,
      z: 0,
    });
    expect(parseRayCast3D(ray, { target_position: 'Vector3(0, 0, 0)' }).target_position).toEqual({
      x: 0,
      y: 0,
      z: 0,
    });
  });

  it('leaves an unauthored target_position undefined, so the consumer applies the default', () => {
    expect(parseRayCast3D(ray, {}).target_position).toBeUndefined();
  });

  it('drops an unparseable target_position as undefined, not NaN', () => {
    expect(parseRayCast3D(ray, { target_position: 'Vector3(nope)' }).target_position).toBeUndefined();
    expect(parseRayCast3D(ray, { target_position: 'Vector3(0, 0, 0, 0)' }).target_position).toBeUndefined();
  });

  // The render-side float grammar is finite by choice (`godot/variant/number.ts`), so a
  // non-finite component falls back to the default instead of putting NaN geometry in three.
  it.each([['Vector3(inf, -3, 0)'], ['Vector3(0, -3, nan)'], ['Vector3(1e999, 0, 0)']])(
    'drops a non-finite target_position %s as undefined',
    (literal) => {
      expect(parseRayCast3D(ray, { target_position: literal }).target_position).toBeUndefined();
    }
  );

  it('reads debug_shape_custom_color', () => {
    expect(
      parseRayCast3D(ray, { debug_shape_custom_color: 'Color(1, 0, 0, 1)' }).debug_shape_custom_color
    ).toEqual({
      r: 1,
      g: 0,
      b: 0,
      a: 1,
    });
  });

  it('leaves debug_shape_custom_color undefined when absent or malformed', () => {
    expect(parseRayCast3D(ray, {}).debug_shape_custom_color).toBeUndefined();
    expect(
      parseRayCast3D(ray, { debug_shape_custom_color: 'rgb(1, 0, 0)' }).debug_shape_custom_color
    ).toBeUndefined();
  });

  it('reads debug_shape_thickness', () => {
    expect(parseRayCast3D(ray, { debug_shape_thickness: '3' }).debug_shape_thickness).toBe(3);
    expect(parseRayCast3D(ray, { debug_shape_thickness: '-2' }).debug_shape_thickness).toBe(-2);
    expect(parseRayCast3D(ray, {}).debug_shape_thickness).toBeUndefined();
    expect(parseRayCast3D(ray, { debug_shape_thickness: 'wide' }).debug_shape_thickness).toBeUndefined();
  });

  it('reads enabled as written, and leaves it undefined when unauthored', () => {
    expect(parseRayCast3D(ray, { enabled: 'true' }).enabled).toBe(true);
    expect(parseRayCast3D(ray, { enabled: 'false' }).enabled).toBe(false);
    expect(parseRayCast3D(ray, { enabled: '1' }).enabled).toBe(true);
    expect(parseRayCast3D(ray, { enabled: 'long' }).enabled).toBe(false);
    expect(parseRayCast3D(ray, {}).enabled).toBeUndefined();
  });
});
