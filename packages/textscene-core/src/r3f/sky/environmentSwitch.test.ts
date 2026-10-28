import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { environmentSwitch } from './environmentSwitch';

/** The last mip three's CubeUV defines give a scene environment of `height` (r186 `WebGLProgram.js:404`). */
const cubeUvLastMip = (height: number) => Math.log2(height) - 2;

describe('environmentSwitch', () => {
  it("turns on three's environment lighting in the CubeUV layout, which the sky lighting patch replaces", () => {
    expect(environmentSwitch().mapping).toBe(THREE.CubeUVReflectionMapping);
  });

  it("gives three's CubeUV defines a last mip no lower than its first, 4, so the program compiles (edge case)", () => {
    expect(cubeUvLastMip(environmentSwitch().image.height)).toBeGreaterThanOrEqual(4);
  });

  it('is one texture for every sky', () => {
    expect(environmentSwitch()).toBe(environmentSwitch());
  });
});
