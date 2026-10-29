import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ENVIRONMENT_SWITCH } from './environmentSwitch';

/** The last mip three's CubeUV defines give a scene environment of `height` (r186 `WebGLProgram.js:404`). */
const cubeUvLastMip = (height: number) => Math.log2(height) - 2;

describe('ENVIRONMENT_SWITCH', () => {
  it("turns on three's environment lighting in the CubeUV layout, which the sky lighting patch replaces", () => {
    expect(ENVIRONMENT_SWITCH.mapping).toBe(THREE.CubeUVReflectionMapping);
  });

  it("gives three's CubeUV defines a last mip no lower than its first, 4, so the program compiles (edge case)", () => {
    expect(cubeUvLastMip(ENVIRONMENT_SWITCH.image.height)).toBeGreaterThanOrEqual(4);
  });
});
