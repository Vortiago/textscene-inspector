import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { backgroundPlane } from './backgroundPrograms';

describe('backgroundPlane', () => {
  it("is three's flat background program, which a patch writes in place", () => {
    expect(backgroundPlane()).toBe(THREE.ShaderLib.background);
  });
});
