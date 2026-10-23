import { describe, expect, it } from 'vitest';
import { godotColorToLinear } from '../godotColor';
import { axisCross } from './axisCross';

const linear = (r: number, g: number, b: number) => godotColorToLinear({ r, g, b });
const rgb = (color: { r: number; g: number; b: number }) => [color.r, color.g, color.b];
const closeTo = (values: number[]) => values.map((value) => expect.closeTo(value, 6));

describe('axisCross', () => {
  it('draws each axis as a positive arm then a negative arm, both through the origin', () => {
    const { positions } = axisCross(2, ['x', 'y', 'z']);
    expect(Array.from(positions)).toEqual([
      ...[2, 0, 0, 0, 0, 0, 0, 0, 0, -2, 0, 0],
      ...[0, 2, 0, 0, 0, 0, 0, 0, 0, 0, -2, 0],
      ...[0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, -2],
    ]);
  });

  it('colours the positive arm with the axis colour and the negative arm darkened by 0.5', () => {
    const { colors } = axisCross(1, ['x', 'z']);
    const red = rgb(linear(0.96, 0.2, 0.32));
    const darkRed = rgb(linear(0.48, 0.1, 0.16));
    const blue = rgb(linear(0.16, 0.55, 0.96));
    const darkBlue = rgb(linear(0.08, 0.275, 0.48));
    expect(Array.from(colors)).toEqual(
      closeTo([...red, ...red, ...darkRed, ...darkRed, ...blue, ...blue, ...darkBlue, ...darkBlue])
    );
  });

  it('gives each segment end three position floats and three colour floats', () => {
    const { positions, colors } = axisCross(1, ['x', 'y']);
    expect(positions.length).toBe(colors.length);
  });
});
