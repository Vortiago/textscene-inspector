import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { Vector3Axis } from '../../../godot/math/vector3Axis';
import { BillboardMode } from '../sprite3d/types';
import { parseAnimatedSprite3D } from './parser';

function parse(properties: Record<string, string>) {
  return parseAnimatedSprite3D(heading('AnimatedSprite3D', { name: 'Coin' }), properties);
}

describe('parseAnimatedSprite3D', () => {
  it('reads what places the quad', () => {
    const parsed = parse({
      pixel_size: '0.05',
      axis: '1',
      billboard: '1',
      centered: 'false',
      offset: 'Vector2(2, 3)',
    });
    expect(parsed).toMatchObject({
      pixel_size: 0.05,
      axis: Vector3Axis.Y,
      billboard: BillboardMode.BILLBOARD_ENABLED,
      centered: false,
      offset: { x: 2, y: 3 },
    });
  });

  it('takes Godot’s defaults for absent properties', () => {
    expect(parse({})).toMatchObject({ pixel_size: 0.01, axis: Vector3Axis.Z, centered: true });
  });

  it('keeps an out-of-range axis at its default', () => {
    expect(parse({ axis: '7' }).axis).toBe(Vector3Axis.Z);
  });
});
