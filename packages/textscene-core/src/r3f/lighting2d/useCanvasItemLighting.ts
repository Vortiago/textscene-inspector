/**
 * The hook side of `canvasItemLightingProps`. It owns one set of uniform objects
 * per item for its whole life and mutates their `.value`: three captures what
 * `onBeforeCompile` assigns at first compile, and R3F never sets `needsUpdate`,
 * so a fresh uniform object never reaches the GPU.
 */

import { useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { useCanvasModulate } from '../canvasModulate.js';
import {
  CanvasItemLightMode,
  type CanvasItemMaterialProperties,
} from '../../resources/materials/canvasitemmaterial/types.js';
import { useCanvasLighting2D, useCapItemLights, useRegisterLitItem } from './CanvasLighting2D.js';
import {
  canvasItemLightingProps,
  type CanvasItemLightingProps,
  type CanvasItemLightingUniforms,
} from './canvasItemLighting.js';
import { placementId } from './itemLightList.js';
import { useCanvasLayerIndex, useEffectiveZ } from './canvasItemPlacement.js';

export type { CanvasItemLightingProps };

/**
 * Bound while no light reaches the item, and as the tint of a list no light tints. Transparent
 * black, so the tint adds nothing, and a sampler uniform still has to point at a real texture.
 */
const EMPTY_LIGHT_BUFFER: THREE.DataTexture = (() => {
  const texture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
})();

function createUniforms(resolution: THREE.Vector2): CanvasItemLightingUniforms {
  return {
    lightBuffer: { value: EMPTY_LIGHT_BUFFER as THREE.Texture },
    shadowTintBuffer: { value: EMPTY_LIGHT_BUFFER as THREE.Texture },
    isLit: { value: 0 },
    resolution: { value: resolution },
    canvasModulate: { value: new THREE.Vector3(1, 1, 1) },
    lightMode: { value: CanvasItemLightMode.NORMAL },
  };
}

/** What an item binds to read its light list. */
export interface CanvasItemLighting {
  /** The material props, which never change once mounted. */
  readonly props: CanvasItemLightingProps;
  /**
   * For the object that holds the item's own geometry, its child items left out. The per-item cap
   * measures its rect (`itemLightCap.ts`).
   */
  readonly geometryRef: RefObject<THREE.Object3D | null>;
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
): CanvasItemLighting {
  const { lists, resolution } = useCanvasLighting2D();
  const inheritedZ = useEffectiveZ();
  const itemZ = effectiveZ ?? inheritedZ;
  const canvasLayer = useCanvasLayerIndex();
  // The raw canvas tint, not the light-mode-gated one: the shader divides out
  // exactly what the CPU folded in, and the floor is applied on both sides.
  const canvasModulate = useCanvasModulate();
  const lightMode = material?.lightMode ?? CanvasItemLightMode.NORMAL;
  const lightOnly = lightMode === CanvasItemLightMode.LIGHT_ONLY;

  // Godot's cull test (`light_mask`, `z_final` and the canvas layer) picks the item's light list,
  // so items at one placement share it. The unmodulated accumulation costs a second pre-pass, so a
  // list has one only while a Light Only item reads it.
  // Past 15 positional lights at its placement, the item's rect picks which it takes.
  const geometryRef = useRef<THREE.Object3D | null>(null);
  const [positionalLights, setPositionalLights] = useState<readonly number[] | null>(null);
  const placement = { lightMask, z: itemZ, layer: canvasLayer, positionalLights };
  useCapItemLights(placement, geometryRef, setPositionalLights);
  useRegisterLitItem(placement, lightOnly);
  const list = lists.get(placementId(placement));

  const uniforms = useRef<CanvasItemLightingUniforms | null>(null);
  uniforms.current ??= createUniforms(resolution);
  const bound = uniforms.current;

  // Mutating in render keeps the GPU in step without a recompile, and re-running
  // plain value writes is harmless.
  const accumulation = lightOnly ? list?.lightOnlyBuffer : list?.buffer;
  bound.isLit.value = accumulation ? 1 : 0;
  bound.lightBuffer.value = accumulation ?? EMPTY_LIGHT_BUFFER;
  bound.shadowTintBuffer.value = (accumulation ? list?.shadowTintBuffer : null) ?? EMPTY_LIGHT_BUFFER;
  // The provider owns these textures and this vector, so a resize or a
  // reallocation reaches every item without a re-render.
  bound.resolution.value = resolution;
  (bound.canvasModulate.value as THREE.Vector3).set(canvasModulate.r, canvasModulate.g, canvasModulate.b);
  // The mode rides the uniforms too: a re-parse changes `light_mode` under a
  // mounted item, and three would keep the program it first compiled.
  bound.lightMode.value = lightMode;

  // Mode-independent by design: these props must never change once mounted.
  const props = useMemo(() => canvasItemLightingProps(bound), [bound]);
  return useMemo(() => ({ props, geometryRef }), [props]);
}
