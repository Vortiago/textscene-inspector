/** The accessors hand back the programs three draws its backgrounds with, not copies. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { backgroundCube, backgroundPlane } from './backgroundPrograms';

describe('backgroundCube', () => {
  it("is three's cube background program, which a patch writes in place", () => {
    expect(backgroundCube()).toBe(THREE.ShaderLib.backgroundCube);
  });
});

describe('backgroundPlane', () => {
  it("is three's flat background program, which a patch writes in place", () => {
    expect(backgroundPlane()).toBe(THREE.ShaderLib.background);
  });
});
