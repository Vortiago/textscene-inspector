/**
 * The hook side of `canvasItemLightingProps` and `normalMappedLightingProps`. It owns one set of
 * uniform objects per item, and one per normal-mapped surface, for their whole life and mutates
 * their `.value`: three captures what `onBeforeCompile` assigns at first compile, and R3F never
 * sets `needsUpdate`, so a fresh uniform object never reaches the GPU.
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
import { placementId, type ItemPlacement, type LitItemRead } from './itemLightList.js';
import { releasedOnUnmount } from '../sharedTexture.js';
import { useCanvasLayerIndex } from './canvasItemPlacement.js';
import { CanvasItemMaterialLightMode } from '../../godot/scene/canvasItemMaterial.js';
import {
  normalMappedLightingProps,
  type CanvasItemSurface,
  type NormalMappedLightingUniforms,
} from './normalMappedLighting.js';
import type { ApartLightBuffers, CanvasLightList } from './lightPassContext.js';
import { defaultWhiteTexture } from '../materials/defaultWhiteTexture.js';

export type { CanvasItemLightingProps };

/** `texture`, read raw and uploaded on first use. */
function rawTexel<T extends THREE.DataTexture | THREE.DataArrayTexture>(texture: T): T {
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Bound while no light reaches the item, and as the tint of a list no light tints. Transparent
 * black, so the tint adds nothing, and a sampler uniform still has to point at a real texture.
 */
const EMPTY_LIGHT_BUFFER = releasedOnUnmount(
  rawTexel(new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1))
);

/** The `shadow_color` layers of a list no light tints: one transparent black layer. */
const EMPTY_LIGHT_LAYERS = releasedOnUnmount(
  rawTexel(new THREE.DataArrayTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, 1))
);

/** A flat normal, (0, 0, 1) encoded, until the item binds its own map. */
const FLAT_NORMAL_MAP = releasedOnUnmount(
  rawTexel(new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1))
);

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
    normalMap: { value: FLAT_NORMAL_MAP as THREE.Texture },
    specularMap: { value: defaultWhiteTexture() as THREE.Texture },
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
  uniforms.places.value = apart.places;
  uniforms.modes.value = apart.modes;
  uniforms.normalMap.value = surface.normalMap;
  // Godot's default specular map is white (`texture_storage.cpp:773-776`).
  uniforms.specularMap.value = surface.specularMap ?? defaultWhiteTexture();
  const { specular } = surface;
  if (specular)
    (uniforms.specular.value as THREE.Vector4).set(specular.r, specular.g, specular.b, specular.a);
  uniforms.usesSpecular.value = specular ? 1 : 0;
}

/**
 * The normal-mapped program's uniforms, created once for the first surface and bound to `apart`
 * and `surface` while both are there. Null while no surface has asked for them.
 */
function useNormalMappedUniforms(
  plain: CanvasItemLightingUniforms,
  apart: ApartLightBuffers | null,
  surface: CanvasItemSurface | null
): NormalMappedLightingUniforms | null {
  const uniforms = useRef<NormalMappedLightingUniforms | null>(null);
  if (surface) uniforms.current ??= createNormalMappedUniforms(plain);
  if (uniforms.current && apart && surface) bindNormalMapped(uniforms.current, apart, surface);
  return uniforms.current;
}

/** Where an item sits and what it draws with, for its light list. */
interface LitItemOptions {
  material: CanvasItemMaterialProperties | null;
  /** The item's CanvasItem `light_mask`, or Godot's default 1 for a node without one. */
  lightMask?: number;
  /** The item's own `z_final`, which a light's z window tests (`canvasItemState.tsx`). */
  zFinal: number;
}

/**
 * What the surfaces of one lit canvas item share: its place, its light list and its plain
 * uniforms. A surface is a mesh that draws with its own normal and specular maps, or with none.
 */
export interface LitItem {
  readonly placement: ItemPlacement;
  readonly lightMode: CanvasItemMaterialProperties['lightMode'];
  /** Undefined while no light reaches the item. */
  readonly list: CanvasLightList | undefined;
  readonly plain: CanvasItemLightingUniforms;
  /** The material props of a surface that has no normal map, which never change once mounted. */
  readonly plainProps: CanvasItemLightingProps;
  /**
   * For the object that holds the item's own geometry, its child items left out. The per-item cap
   * measures its rect (`itemLightCap.ts`).
   */
  readonly geometryRef: RefObject<THREE.Object3D | null>;
}

export function useLitItem({ material, lightMask = 1, zFinal }: LitItemOptions): LitItem {
  const { lists, resolution } = useCanvasLighting2D();
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
  const placement = useMemo<ItemPlacement>(
    () => ({ lightMask, z: zFinal, layer: canvasLayer, takenLights }),
    [lightMask, zFinal, canvasLayer, takenLights]
  );
  useCapItemLights(placement, geometryRef, setTakenLights);
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

  const plainProps = useMemo(() => canvasItemLightingProps(bound), [bound]);
  return useMemo(
    () => ({ placement, lightMode, list, plain: bound, plainProps, geometryRef }),
    [placement, lightMode, list, bound, plainProps]
  );
}

/**
 * The material props of one surface of `item`, which declare the accumulation the surface reads.
 * A surface with a normal map takes each light apart, and one without takes the item's plain
 * accumulation, so the surfaces of one item may read both.
 */
export function useSurfaceLighting(
  item: LitItem,
  surface: CanvasItemSurface | null
): CanvasItemLightingProps {
  const { placement, lightMode, list, plain, plainProps } = item;
  const readsNormals = surface !== null && lightMode !== CanvasItemMaterialLightMode.UNSHADED;
  const lightOnly = lightMode === CanvasItemMaterialLightMode.LIGHT_ONLY;
  const read: LitItemRead = readsNormals ? 'apart' : lightOnly ? 'lightOnly' : 'plain';
  useRegisterLitItem(placement, read);

  // A normal map scales each light by its own normal term, so it shades the lights the list keeps
  // apart.
  const apart = read === 'apart' ? (list?.apart ?? null) : null;
  const shaded = useNormalMappedUniforms(plain, apart, surface);
  const apartCount = apart?.places.length ?? 0;

  // Mode-independent by design: the props change only with the count of lights kept apart, which
  // sizes the program, and the key that follows it remounts the material.
  return useMemo(
    () => (shaded && apartCount > 0 ? normalMappedLightingProps(shaded, apartCount) : plainProps),
    [plainProps, shaded, apartCount]
  );
}
