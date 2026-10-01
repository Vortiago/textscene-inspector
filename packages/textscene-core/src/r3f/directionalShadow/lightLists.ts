/**
 * The lights of a scene as the fitter sees them, and Godot's two lists of its directional lights:
 * the lights the renderer draws, and the shadowed lights that share the directional shadow atlas
 * (`renderer_scene_cull.cpp:3249-3282`).
 */

import type * as THREE from 'three';
import {
  DIRECTIONAL_SHADOW_SIZE_DEFAULT,
  directionalLightsDrawn,
  directionalLightsWithShadow,
  directionalShadowLightRect,
  type DirectionalShadowAtlasRect,
} from '../../godot/directionalShadow.js';
import { readDirectionalShadowDeclaration, type DirectionalShadowDeclaration } from './declaration.js';

/** A light in the scene, and whether three's render reaches it: it and every ancestor are visible. */
export interface SceneLight {
  light: THREE.Light;
  isVisible: boolean;
}

/** A directional light that declared its shadow. */
export interface DeclaredLight extends SceneLight {
  light: THREE.DirectionalLight;
  declaration: DirectionalShadowDeclaration;
}

/**
 * Every light in the scene, in the pre-order three's `projectObject` visits them (r186
 * `WebGLRenderer.js:1860-1888`), each marked by whether the render reaches it.
 */
export function sceneLights(scene: THREE.Object3D): SceneLight[] {
  const lights: SceneLight[] = [];
  collectLights(scene, true, lights);
  return lights;
}

function collectLights(object: THREE.Object3D, isParentVisible: boolean, lights: SceneLight[]): void {
  const isVisible = isParentVisible && object.visible;
  if ((object as THREE.Light).isLight) lights.push({ light: object as THREE.Light, isVisible });
  for (const child of object.children) collectLights(child, isVisible, lights);
}

/** The declared directional lights among `lights`, hidden ones included. */
export function declaredLights(lights: readonly SceneLight[]): DeclaredLight[] {
  const declared: DeclaredLight[] = [];
  for (const { light, isVisible } of lights) {
    const directional = light as THREE.DirectionalLight;
    if (!directional.isDirectionalLight) continue;
    const declaration = readDirectionalShadowDeclaration(directional);
    if (declaration) declared.push({ light: directional, declaration, isVisible });
  }
  return declared;
}

/** Godot's lists for a scene: the lights it draws, and each shadowed light's share of the atlas. */
export interface DirectionalLightLists {
  drawn: ReadonlySet<THREE.DirectionalLight>;
  shares: ReadonlyMap<THREE.DirectionalLight, DirectionalShadowAtlasRect>;
}

/**
 * Godot's lists, from the visible declared lights in pre-order. Godot also skips a light on a layer
 * the camera does not see (`renderer_scene_cull.cpp:3258`). The previewer maps neither `cull_mask`
 * nor `layers` to three, so the lists ignore layers. Lists per camera would cost two cameras that
 * differ a sun attached and released, its map reallocated and every program switched on each render.
 */
export function directionalLightLists(declared: readonly DeclaredLight[]): DirectionalLightLists {
  const visible = declared.filter(({ isVisible }) => isVisible);
  const shadowed = directionalLightsWithShadow(visible, ({ declaration }) => declaration.sharesAtlas);
  const shares = new Map<THREE.DirectionalLight, DirectionalShadowAtlasRect>();
  shadowed.forEach(({ light }, index) => {
    shares.set(light, directionalShadowLightRect(DIRECTIONAL_SHADOW_SIZE_DEFAULT, shadowed.length, index));
  });
  return { drawn: new Set(directionalLightsDrawn(visible).map(({ light }) => light)), shares };
}
