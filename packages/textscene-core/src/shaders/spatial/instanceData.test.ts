import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { instanceWords, transposed3x4 } from './instanceData.js';

const floatsOf = (words: Uint32Array) => new Float32Array(words.buffer);

const moved = () =>
  new THREE.Matrix4().compose(new THREE.Vector3(1, 2, 3), new THREE.Quaternion(), new THREE.Vector3(2, 2, 2));

describe('transposed3x4', () => {
  it('writes the first three rows, each with its lane of the origin last', () => {
    expect(transposed3x4(moved())).toEqual([2, 0, 0, 1, 0, 2, 0, 2, 0, 0, 2, 3]);
  });
});

describe('instanceWords', () => {
  it('writes the transform twice, as this frame and the last, and a surface box of size 1', () => {
    const floats = floatsOf(instanceWords(moved()));
    expect([...floats.slice(0, 12)]).toEqual([...floats.slice(28, 40)]);
    expect([...floats.slice(12, 20)]).toEqual([0, 0, 0, 0, 1, 1, 1, 0]);
  });

  it('writes an opaque fade, no instance uniforms and the first layer', () => {
    const words = instanceWords(moved());
    expect([words[24], words[25], words[27]]).toEqual([0xff000000, 0xffffffff, 1]);
  });

  it('sets the non-uniform scale bit when one axis is under 0.9 of the largest', () => {
    const squashed = new THREE.Matrix4().makeScale(1, 0.8, 1);
    expect(instanceWords(squashed)[24]! & (1 << 4)).toBe(1 << 4);
    expect(instanceWords(new THREE.Matrix4().makeScale(1, 0.95, 1))[24]! & (1 << 4)).toBe(0);
  });
});
