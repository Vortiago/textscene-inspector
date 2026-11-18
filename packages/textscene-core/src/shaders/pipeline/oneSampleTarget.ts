import type * as THREE from 'three';

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
