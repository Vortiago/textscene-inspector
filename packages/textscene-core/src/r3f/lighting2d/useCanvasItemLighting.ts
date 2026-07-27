/**
 * The hook side of `canvasItemLightingProps`.
 *
 * It owns ONE set of uniform objects per item for the item's whole life and
 * mutates their `.value` as the light state changes. That is not an
 * optimisation: three captures whatever `onBeforeCompile` assigns at first
 * compile, and R3F never bumps `material.needsUpdate` when the prop changes, so
 * a freshly-built uniform object would never reach the GPU. Replacing the
 * uniforms is exactly the bug that left every item on a stock shader once a
 * light appeared after mount.
 *
 * The buffer's texture and the resolution vector are bound by REFERENCE to the
 * ones the provider owns, so a resize or a reallocation reaches every item
 * without a re-render.
 */

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useCanvasModulate } from '../canvasModulate.js';
import {
  CanvasItemLightMode,
  type CanvasItemMaterialProperties,
} from '../../resources/materials/canvasitemmaterial/types.js';
import { useCanvasLighting2D, useRegisterLightOnlyItem } from './CanvasLighting2D.js';
import { canvasItemLightingProps, type CanvasItemLightingProps } from './canvasItemLighting.js';

export type { CanvasItemLightingProps };

/**
 * Bound while a canvas has no light. Never sampled — `uLightsActive` is 0 — but
 * a sampler uniform still has to point at a real texture, and one shared 1x1 is
 * cheaper than one per item.
 */
const EMPTY_LIGHT_BUFFER: THREE.DataTexture = (() => {
  const texture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
})();

export function useCanvasItemLighting(
  material: CanvasItemMaterialProperties | null
): CanvasItemLightingProps {
  const { buffer, lightOnlyBuffer, resolution } = useCanvasLighting2D();
  // The RAW canvas tint, not the light-mode-gated one: the shader divides out
  // exactly what the CPU folded in, and the floor is applied on both sides.
  const canvasModulate = useCanvasModulate();
  const lightMode = material?.lightMode ?? CanvasItemLightMode.NORMAL;
  const lightOnly = lightMode === CanvasItemLightMode.LIGHT_ONLY;

  // The unmodulated accumulation costs a second pre-pass, so it is allocated
  // only once an item that reads it exists.
  useRegisterLightOnlyItem(lightOnly);
  const accumulation = lightOnly ? lightOnlyBuffer : buffer;

  const uniforms = useRef({
    uLightBuffer: { value: EMPTY_LIGHT_BUFFER as THREE.Texture },
    uLightResolution: { value: resolution },
    uCanvasModulate: { value: new THREE.Vector3(1, 1, 1) },
    uLightsActive: { value: 0 },
  }).current;

  // Mutating in render keeps the GPU in step without a recompile; these are
  // plain value writes, so re-running them is harmless.
  uniforms.uLightBuffer.value = accumulation ?? EMPTY_LIGHT_BUFFER;
  uniforms.uLightResolution.value = resolution;
  uniforms.uLightsActive.value = accumulation ? 1 : 0;
  (uniforms.uCanvasModulate.value as THREE.Vector3).set(
    canvasModulate.r,
    canvasModulate.g,
    canvasModulate.b
  );

  return useMemo(() => canvasItemLightingProps({ uniforms, lightMode }), [uniforms, lightMode]);
}
