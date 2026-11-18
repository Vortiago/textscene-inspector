import type * as THREE from 'three';
import { Discard, Fn, If, uniform, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import {
  AlphaAntiAliasing,
  type AlphaToCoverageMode,
} from '../../godot/rendering/materials/alphaAntialiasing.js';

type GlContext = WebGLRenderingContext | WebGL2RenderingContext;

/** Each context's `antialias` attribute, fixed for the context's life. Collected with it. */
// eslint-disable-next-line no-restricted-syntax -- perObject is outside the shader module, which imports only its own files (ADR-0072).
const canvasAntialias = new WeakMap<GlContext, boolean>();

/** Whether the renderer draws into a target with more than one sample per pixel. */
function drawsMultisampled(renderer: THREE.WebGLRenderer): boolean {
  const target = renderer.getRenderTarget();
  if (target) return target.samples > 0;
  const context = renderer.getContext();
  let isAntialiased = canvasAntialias.get(context);
  if (isAntialiased === undefined) {
    isAntialiased = context.getContextAttributes()?.antialias === true;
    canvasAntialias.set(context, isAntialiased);
  }
  return isAntialiased;
}

/** Whether WebGL skips the alpha to coverage `material` turns on, as the target has one sample. */
export const coversOneSample = (material: THREE.Material, renderer: THREE.WebGLRenderer): boolean =>
  material.alphaToCoverage && !drawsMultisampled(renderer);

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
