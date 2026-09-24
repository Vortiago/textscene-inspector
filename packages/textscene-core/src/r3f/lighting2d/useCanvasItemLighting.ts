/**
 * The hook side of `canvasItemLightingProps`. It owns one set of uniform objects
 * per item for its whole life and mutates their `.value`: three captures what
 * `onBeforeCompile` assigns at first compile, and R3F never sets `needsUpdate`,
 * so a fresh uniform object never reaches the GPU.
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
  type CanvasItemLightingProps,
  type CanvasItemLightingUniforms,
} from './canvasItemLighting.js';
import { lightReachesItem } from './lightCullKey.js';
import { useCanvasLayerIndex, useEffectiveZ } from './canvasItemPlacement.js';

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
    shadowTintBuffers: Array.from({ length: MAX_LIGHT_CLASSES }, () => ({
      value: EMPTY_LIGHT_BUFFER as THREE.Texture,
    })),
    classWeights: { value: new Array<number>(MAX_LIGHT_CLASSES).fill(0) },
    resolution: { value: resolution },
    canvasModulate: { value: new THREE.Vector3(1, 1, 1) },
    lightMode: { value: CanvasItemLightMode.NORMAL },
  };
}

export function useCanvasItemLighting(
  material: CanvasItemMaterialProperties | null,
  /** The item's CanvasItem `light_mask`; Godot's default 1 for a node without one. */
  lightMask = 1,
  /**
   * The item's own `z_final`. Defaults to the enclosing item's accumulated z,
   * which is what every ordinary slice wants; the y-sort pass renders items
   * outside their tree position and so passes the z it computed for them.
   */
  effectiveZ?: number
): CanvasItemLightingProps {
  const { classes, resolution } = useCanvasLighting2D();
  const inheritedZ = useEffectiveZ();
  const itemZ = effectiveZ ?? inheritedZ;
  const canvasLayer = useCanvasLayerIndex();
  // The raw canvas tint, not the light-mode-gated one: the shader divides out
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

  // Mutating in render keeps the GPU in step without a recompile, and re-running
  // plain value writes is harmless.
  const weights = bound.classWeights.value as number[];
  for (let slot = 0; slot < MAX_LIGHT_CLASSES; slot += 1) {
    const lightClass = classes[slot];
    const accumulation = lightOnly ? lightClass?.lightOnlyBuffer : lightClass?.buffer;
    // Godot's cull test (`light_mask`, `z_final` and the canvas layer against
    // `lightCullKey`) runs here, once per item per frame, as a per-slot weight.
    // `canvasItemLighting.ts` says why it cannot run per fragment.
    const lights =
      !!accumulation &&
      lightClass !== undefined &&
      lightReachesItem(lightClass.key, lightMask, itemZ, canvasLayer);
    weights[slot] = lights ? 1 : 0;
    bound.classBuffers[slot]!.value = lights ? accumulation : EMPTY_LIGHT_BUFFER;
    // The stand-in is transparent black, so a class with no shadow-tinting light
    // contributes nothing and needs no separate branch in the shader.
    bound.shadowTintBuffers[slot]!.value =
      (lights ? lightClass?.shadowTintBuffer : null) ?? EMPTY_LIGHT_BUFFER;
  }
  // The provider owns these textures and this vector, so a resize or a
  // reallocation reaches every item without a re-render.
  bound.resolution.value = resolution;
  (bound.canvasModulate.value as THREE.Vector3).set(
    canvasModulate.r,
    canvasModulate.g,
    canvasModulate.b
  );
  // The mode rides the uniforms too: a re-parse changes `light_mode` under a
  // mounted item, and three would keep the program it first compiled.
  bound.lightMode.value = lightMode;

  // Mode-independent by design: these props must never change once mounted.
  return useMemo(() => canvasItemLightingProps(bound), [bound]);
}
