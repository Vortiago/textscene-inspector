/**
 * Whether a renderer's shadow pass is wrapped, for component tests. Test-only: the `testing/`
 * directories under `src` are excluded from the build.
 */
import type * as THREE from 'three';

/** The key `installShadowPass` leaves on a wrapped shadow map (`shadowPass.ts`). */
const SHADOW_PASS = Symbol.for('textscene.shadowPass');

export function hasShadowPass(renderer: THREE.WebGLRenderer): boolean {
  return SHADOW_PASS in renderer.shadowMap;
}
