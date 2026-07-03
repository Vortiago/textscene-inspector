/** Tests for BoxShape3D parser — canonical parseVector3 contract. */

import { describe, expect, it } from 'vitest';
import { parseBoxShape3D } from './parser';

describe('parseBoxShape3D', () => {
  it('honours a valid size', () => {
    expect(parseBoxShape3D({ size: 'Vector3(2, 3, 4)' }).size).toEqual({ x: 2, y: 3, z: 4 });
  });

  it('falls back to the {1,1,1} default for loose-regex-only garbage', () => {
    expect(parseBoxShape3D({ size: 'Vector3(--1, 2, 3)' }).size).toEqual({ x: 1, y: 1, z: 1 });
    expect(parseBoxShape3D({ size: 'Vector3(1e-, 2, 3)' }).size).toEqual({ x: 1, y: 1, z: 1 });
  });
});
