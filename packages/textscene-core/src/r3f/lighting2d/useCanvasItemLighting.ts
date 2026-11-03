/**
 * The hook side of `canvasItemLightingProps` and `normalMappedLightingProps`. It owns one set of
 * uniform objects per item for its whole life and mutates their `.value`: three captures what
 * `onBeforeCompile` assigns at first compile, and R3F never sets `needsUpdate`, so a fresh uniform
 * object never reaches the GPU.
 */

import { useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { useCanvasModulate } from '../canvasModulate.js';
import { type CanvasItemMaterialProperties } from '../../resources/materials/canvasitemmaterial/types.js';
import { useCanvasLighting2D, useCapItemLights, useRegisterLitItem } from './CanvasLighting2D.js';
import {
  canvasItemLightingProps,
  type CanvasItemLightingProps,
  type CanvasItemLightingUniforms,
} from './canvasItemLighting.js';
import { placementId } from './itemLightList.js';
import { releasedOnUnmount } from '../sharedTexture.js';
import { useCanvasLayerIndex, useEffectiveZ } from './canvasItemPlacement.js';
import { CanvasItemMaterialLightMode } from '../../godot/scene/canvasItemMaterial.js';
import {
  normalMappedLightingProps,
  type CanvasItemSurface,
  type NormalMappedLightingUniforms,
} from './normalMappedLighting.js';
import type { ApartLightBuffers } from './lightPassContext.js';

export type { CanvasItemLightingProps };

/**
 * Bound while no light reaches the item, and as the tint of a list no light tints. Transparent
 * black, so the tint adds nothing, and a sampler uniform still has to point at a real texture.
 */
const EMPTY_LIGHT_BUFFER: THREE.DataTexture = (() => {
  const texture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return releasedOnUnmount(texture);
})();

/** The `shadow_color` layers of a list no light tints: one transparent black layer. */
const EMPTY_LIGHT_LAYERS: THREE.DataArrayTexture = (() => {
  const texture = new THREE.DataArrayTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, 1);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return releasedOnUnmount(texture);
})();

/** Godot's default specular map, white (`texture_storage.cpp:773-776`). */
const WHITE_SPECULAR_MAP: THREE.DataTexture = (() => {
  const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return releasedOnUnmount(texture);
})();

function createUniforms(resolution: THREE.Vector2): CanvasItemLightingUniforms {
  return {
    lightBuffer: { value: EMPTY_LIGHT_BUFFER as THREE.Texture },
    shadowTintBuffer: { value: EMPTY_LIGHT_BUFFER as THREE.Texture },
    isLit: { value: 0 },
    resolution: { value: resolution },
    canvasModulate: { value: new THREE.Vector3(1, 1, 1) },
    lightMode: { value: CanvasItemMaterialLightMode.NORMAL },
  };
}

/** The normal-mapped program's uniforms, sharing the resolution, tint and mode objects of `plain`. */
function createNormalMappedUniforms(plain: CanvasItemLightingUniforms): NormalMappedLightingUniforms {
  return {
    resolution: plain.resolution,
    canvasModulate: plain.canvasModulate,
    lightMode: plain.lightMode,
    lightLayers: { value: EMPTY_LIGHT_LAYERS as THREE.Texture },
    shadowTintLayers: { value: EMPTY_LIGHT_LAYERS as THREE.Texture },
    places: { value: [] },
    modes: { value: [] },
    normalMap: { value: EMPTY_LIGHT_BUFFER as THREE.Texture },
    specularMap: { value: WHITE_SPECULAR_MAP as THREE.Texture },
    specular: { value: new THREE.Vector4(1, 1, 1, 1) },
    usesSpecular: { value: 0 },
  };
}

/** Points `uniforms` at the lights `apart` keeps and at the maps of `surface`. */
function bindNormalMapped(
  uniforms: NormalMappedLightingUniforms,
  apart: ApartLightBuffers,
  surface: CanvasItemSurface
): void {
  uniforms.lightLayers.value = apart.buffer;
  uniforms.shadowTintLayers.value = apart.shadowTintBuffer ?? EMPTY_LIGHT_LAYERS;
  uniforms.places.value = apart.lights.map((light) => light.place);
  uniforms.modes.value = apart.lights.map((light) => light.mode);
  uniforms.normalMap.value = surface.normalMap;
  uniforms.specularMap.value = surface.specularMap ?? WHITE_SPECULAR_MAP;
  const { specular } = surface;
  if (specular)
    (uniforms.specular.value as THREE.Vector4).set(specular.r, specular.g, specular.b, specular.a);
  uniforms.usesSpecular.value = specular ? 1 : 0;
}

/** Where an item sits and what it draws with, for its light list. */
interface CanvasItemLightingOptions {
  material: CanvasItemMaterialProperties | null;
  /** The item's CanvasItem `light_mask`; Godot's default 1 for a node without one. */
  lightMask?: number;
  /**
   * The item's own `z_final`. Defaults to the enclosing item's accumulated z, which is what every
   * ordinary slice wants. The y-sort pass renders items outside their tree position and so passes
   * the z it computed for them.
   */
  effectiveZ?: number;
  /** The item's normal and specular maps, or null for an item that has none. */
  surface?: CanvasItemSurface | null;
}

/** What an item binds to read its light list. */
interface CanvasItemLighting {
  /** The material props, which never change once mounted. */
  readonly props: CanvasItemLightingProps;
  /**
   * For the object that holds the item's own geometry, its child items left out. The per-item cap
   * measures its rect (`itemLightCap.ts`).
   */
  readonly geometryRef: RefObject<THREE.Object3D | null>;
}

export function useCanvasItemLighting({
  material,
  lightMask = 1,
  effectiveZ,
  surface = null,
}: CanvasItemLightingOptions): CanvasItemLighting {
  const { lists, resolution } = useCanvasLighting2D();
  const inheritedZ = useEffectiveZ();
  const itemZ = effectiveZ ?? inheritedZ;
  const canvasLayer = useCanvasLayerIndex();
  // The raw canvas tint, not the light-mode-gated one: the shader divides out
  // exactly what the CPU folded in, and the floor is applied on both sides.
  const canvasModulate = useCanvasModulate();
  const lightMode = material?.lightMode ?? CanvasItemMaterialLightMode.NORMAL;
  const lightOnly = lightMode === CanvasItemMaterialLightMode.LIGHT_ONLY;

  // Godot's cull test (`light_mask`, `z_final` and the canvas layer, at
  // `renderer_canvas_render_rd.cpp:2366` and `renderer_viewport.cpp:672`) picks the item's light
  // list, so items at one placement share it. The unmodulated accumulation costs a second pre-pass,
  // so a list has one only while a Light Only item reads it. Past 15 positional lights on its rect, or
  // past the render's budget, the item drops the later ones from its list.
  const geometryRef = useRef<THREE.Object3D | null>(null);
  const [takenLights, setTakenLights] = useState<readonly number[] | null>(null);
  const placement = { lightMask, z: itemZ, layer: canvasLayer, takenLights };
  useCapItemLights(placement, geometryRef, setTakenLights);
  useRegisterLitItem(placement, { lightOnly, normalMapped: surface !== null });
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

  // A normal map scales each light by its own normal term, so it shades the lights the list keeps
  // apart. Until the pass keeps them, it reads the ordinary buffer.
  const normalMapped = useRef<NormalMappedLightingUniforms | null>(null);
  normalMapped.current ??= createNormalMappedUniforms(bound);
  const apart = surface ? list?.apart : null;
  if (apart && surface) bindNormalMapped(normalMapped.current, apart, surface);
  const apartCount = apart?.lights.length ?? 0;

  // Mode-independent by design: the props change only with the count of lights kept apart, which
  // sizes the program, and the key that follows it remounts the material.
  const shaded = normalMapped.current;
  const props = useMemo(
    () => (apartCount > 0 ? normalMappedLightingProps(shaded, apartCount) : canvasItemLightingProps(bound)),
    [bound, shaded, apartCount]
  );
  return useMemo(() => ({ props, geometryRef }), [props]);
}
