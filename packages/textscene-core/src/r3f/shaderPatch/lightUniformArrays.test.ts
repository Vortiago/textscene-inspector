import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LightUniformArrays } from './lightUniformArrays';
import { litUniformArray } from '../testing/litUniformArray';

const NAME = 'testLightTerms';

afterEach(() => {
  for (const shader of Object.values(THREE.ShaderLib)) delete shader.uniforms[NAME];
  delete (THREE.UniformsLib.lights as Record<string, unknown>)[NAME];
});

/** Two floats per light, each light's index and its index plus a half. */
function writeIndices(arrays: LightUniformArrays<typeof NAME>, count: number): void {
  arrays.write(count, (set) => {
    for (let i = 0; i < count; i += 1) set[NAME].set([i, i + 0.5], i * 2);
  });
}

describe('LightUniformArrays', () => {
  it('writes the lights into the arrays the lit materials read', () => {
    const arrays = new LightUniformArrays({ [NAME]: 2 });
    arrays.install();

    writeIndices(arrays, 2);

    expect([...litUniformArray(NAME).subarray(0, 4)]).toEqual([0, 0.5, 1, 1.5]);
  });

  it('grows past its capacity and installs the grown arrays (edge case)', () => {
    const arrays = new LightUniformArrays({ [NAME]: 2 });
    arrays.install();
    const capacity = litUniformArray(NAME).length / 2;

    writeIndices(arrays, capacity + 1);

    expect(litUniformArray(NAME)[capacity * 2]).toBe(capacity);
  });

  it('keeps writing the arrays an older program holds, as far as they reach', () => {
    const arrays = new LightUniformArrays({ [NAME]: 2 });
    arrays.install();
    const older = litUniformArray(NAME);
    const capacity = older.length / 2;
    writeIndices(arrays, capacity + 1);

    arrays.write(1, (set) => set[NAME].set([7, 8], 0));

    expect([...older.subarray(0, 2)]).toEqual([7, 8]);
  });

  it('adopts the arrays an earlier evaluation installed (edge case)', () => {
    const earlier = new LightUniformArrays({ [NAME]: 2 });
    earlier.install();

    expect(new LightUniformArrays({ [NAME]: 2 }).newest()[NAME]).toBe(litUniformArray(NAME));
  });

  it('throws on a write before any light kind is named (error case)', () => {
    expect(() => new LightUniformArrays({}).write(1, () => undefined)).toThrow();
  });
});
