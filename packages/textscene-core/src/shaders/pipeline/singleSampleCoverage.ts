import type * as THREE from 'three';
import { Discard, Fn, If, uniform, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import {
  AlphaAntiAliasing,
  type AlphaToCoverageMode,
} from '../../godot/rendering/materials/alphaAntialiasing.js';
import { coversOneSample } from './oneSampleTarget.js';

type Vec4 = ReturnType<typeof vec4>;

/** WebGL skips alpha to coverage on one sample (GLES 3.0.6 §4.1.3): cut at 0.5, a dithered mask's mean. */
export function coveredOnOneSample(colour: Node, mode: AlphaToCoverageMode): Node {
  const isOneSample = uniform(0).onObjectUpdate(({ material, renderer }) =>
    coversOneSample(material as THREE.Material, renderer as unknown as THREE.WebGLRenderer) ? 1 : 0
  );
  return Fn(() => {
    const covered = (colour as unknown as Vec4).toVar();
    If(isOneSample.equal(1), () => {
      If(covered.a.lessThan(0.5), () => Discard());
      if (mode === AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE_AND_TO_ONE) covered.a.assign(1);
    });
    return covered;
  })() as unknown as Node;
}
