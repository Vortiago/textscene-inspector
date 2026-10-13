import { describe, expect, it } from 'vitest';
import { octToVec3WithBorder, vec3ToOctWithBorder, type OctDirection } from './octmap';

const PADDING = 0.1;
const BORDER_SIZE = 1 - PADDING * 2;

function expectDirection(actual: OctDirection, expected: OctDirection): void {
  actual.forEach((component, axis) => expect(component).toBeCloseTo(expected[axis]!, 6));
}

describe('octToVec3WithBorder', () => {
  it('puts +Z at the centre of the map', () => {
    expectDirection(octToVec3WithBorder(0.5, 0.5, BORDER_SIZE), [0, 0, 1]);
  });

  it('puts -Z at each corner of the area inside the padding', () => {
    expectDirection(octToVec3WithBorder(PADDING, PADDING, BORDER_SIZE), [0, 0, -1]);
    expectDirection(octToVec3WithBorder(1 - PADDING, PADDING, BORDER_SIZE), [0, 0, -1]);
  });

  it('mirrors a texel in the padding onto the direction across the edge (edge case)', () => {
    const inside = 1 - PADDING - 0.02;
    const beyond = 1 - PADDING + 0.02;
    const [x, y, z] = octToVec3WithBorder(inside, 0.3, BORDER_SIZE);
    expectDirection(octToVec3WithBorder(beyond, 0.7, BORDER_SIZE), [x, y, z]);
  });
});

describe('vec3ToOctWithBorder', () => {
  it.each([[[0, 1, 0]], [[0.6, 0, 0.8]], [[-0.48, 0.6, -0.64]], [[0, -0.6, -0.8]]] as const)(
    'maps %j back to itself through octToVec3WithBorder',
    ([x, y, z]) => {
      const uv = new Float64Array(2);
      vec3ToOctWithBorder(x, y, z, PADDING, uv);
      expectDirection(octToVec3WithBorder(uv[0]!, uv[1]!, BORDER_SIZE), [x, y, z]);
    }
  );

  it('accepts a direction that is not unit length', () => {
    const uv = new Float64Array(2);
    vec3ToOctWithBorder(0, 0, 5, PADDING, uv);
    expect([...uv]).toEqual([0.5, 0.5]);
  });
});
