import { describe, expect, it } from 'vitest';
import { fourCustomLanes } from './meshArrayFormat.js';

/** The lanes of `count` vertices, where lane `l` of vertex `v` reads `10 * v + l + 1`. */
const lanesOf = (count: number, width: number) => [
  ...fourCustomLanes(count, width, (vertex, lane) => 10 * vertex + lane + 1),
];

describe('fourCustomLanes', () => {
  it.each<[string, number, number, number[]]>([
    ['one lane: the rest 0 and the alpha 1', 2, 1, [1, 0, 0, 1, 11, 0, 0, 1]],
    ['two lanes', 2, 2, [1, 2, 0, 1, 11, 12, 0, 1]],
    ['three lanes', 2, 3, [1, 2, 3, 1, 11, 12, 13, 1]],
    ['four lanes: every lane read', 2, 4, [1, 2, 3, 4, 11, 12, 13, 14]],
    ['no vertex: no lane', 0, 4, []],
  ])('%s', (_, count, width, expected) => {
    expect(lanesOf(count, width)).toEqual(expected);
  });
});
