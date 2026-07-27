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
 * The buffers' textures and the resolution vector are bound by REFERENCE to the
 * ones the provider owns, so a resize or a reallocation reaches every item
 * without a re-render.
 *
 * Godot's cull test, `light.range_item_cull_mask & item.light_mask != 0`,
 * runs HERE, once per item per frame, and reaches the shader as a per-slot
 * weight. See `canvasItemLighting.ts` for why it cannot run per fragment.
 */

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useCanvasModulate } from '../canvasModulate.js';
import {
  CanvasItemLightMode,
  type CanvasItemMaterialProperties,
} from '../../resources/materials/canvasitemmaterial/types.js';
import {
  MAX_LIGHT_CLASSES,
  useCanvasLighting2D,
  useRegisterLightOnlyItem,
} from './CanvasLighting2D.js';
import {
  canvasItemLightingProps,
  lightReachesItem,
  type CanvasItemLightingProps,
  type CanvasItemLightingUniforms,
} from './canvasItemLighting.js';

export type { CanvasItemLightingProps };

/**
 * Bound to a class slot this item is culled from. Never sampled, since the
 * slot's weight is 0, but a sampler uniform still has to point at a real
 * texture, and one shared 1x1 is cheaper than one per item per slot.
 */
const EMPTY_LIGHT_BUFFER: THREE.DataTexture = (() => {
  const texture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
})();

function createUniforms(resolution: THREE.Vector2): CanvasItemLightingUniforms {
  return {
    classBuffers: Array.from({ length: MAX_LIGHT_CLASSES }, () => ({
      value: EMPTY_LIGHT_BUFFER as THREE.Texture,
    })),
    classWeights: { value: new Array<number>(MAX_LIGHT_CLASSES).fill(0) },
    resolution: { value: resolution },
    canvasModulate: { value: new THREE.Vector3(1, 1, 1) },
  };
}

export function useCanvasItemLighting(
  material: CanvasItemMaterialProperties | null,
  /** The item's CanvasItem `light_mask`; Godot's default 1 for a node without one. */
  lightMask = 1
): CanvasItemLightingProps {
  const { classes, resolution } = useCanvasLighting2D();
  // The RAW canvas tint, not the light-mode-gated one: the shader divides out
  // exactly what the CPU folded in, and the floor is applied on both sides.
  const canvasModulate = useCanvasModulate();
  const lightMode = material?.lightMode ?? CanvasItemLightMode.NORMAL;
  const lightOnly = lightMode === CanvasItemLightMode.LIGHT_ONLY;

  // The unmodulated accumulation costs a second pre-pass per class, so it is
  // allocated only once an item that reads it exists.
  useRegisterLightOnlyItem(lightOnly);

  const uniforms = useRef<CanvasItemLightingUniforms | null>(null);
  uniforms.current ??= createUniforms(resolution);
  const bound = uniforms.current;

  // Mutating in render keeps the GPU in step without a recompile; these are
  // plain value writes, so re-running them is harmless.
  const weights = bound.classWeights.value as number[];
  for (let slot = 0; slot < MAX_LIGHT_CLASSES; slot += 1) {
    const lightClass = classes[slot];
    const accumulation = lightOnly ? lightClass?.lightOnlyBuffer : lightClass?.buffer;
    const lights =
      !!accumulation &&
      lightClass !== undefined &&
      lightReachesItem(lightClass.cullMask, lightMask);
    weights[slot] = lights ? 1 : 0;
    bound.classBuffers[slot]!.value = lights ? accumulation : EMPTY_LIGHT_BUFFER;
  }
  bound.resolution.value = resolution;
  (bound.canvasModulate.value as THREE.Vector3).set(
    canvasModulate.r,
    canvasModulate.g,
    canvasModulate.b
  );

  return useMemo(() => canvasItemLightingProps({ uniforms: bound, lightMode }), [bound, lightMode]);
}
