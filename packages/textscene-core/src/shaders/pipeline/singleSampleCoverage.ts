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
export function drawsMultisampled(renderer: THREE.WebGLRenderer): boolean {
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

type Vec4 = ReturnType<typeof vec4>;

/**
 * `colour` under alpha to coverage on a target with one sample, where WebGL skips it (GLES 3.0.6 §4.1.3).
 * Vulkan leaves the one-sample mask to the implementation, so the sample is covered from alpha 0.5,
 * the mean of a dithered mask. Alpha to one forces the alpha after.
 */
export function coveredOnOneSample(colour: Node, mode: AlphaToCoverageMode): Node {
  const coversOneSample = uniform(0).onObjectUpdate(({ renderer }) =>
    drawsMultisampled(renderer as unknown as THREE.WebGLRenderer) ? 0 : 1
  );
  return Fn(() => {
    const covered = (colour as unknown as Vec4).toVar();
    If(coversOneSample.equal(1), () => {
      If(covered.a.lessThan(0.5), () => Discard());
      if (mode === AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE_AND_TO_ONE) covered.a.assign(1);
    });
    return covered;
  })() as unknown as Node;
}
