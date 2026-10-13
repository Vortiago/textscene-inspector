/**
 * The renderer's shadow pass. three r186 has no hook between its shadow pass and its draw
 * (`WebGLRenderer.js:1737-1752`), so the pass runs three's pass, then Godot's copy of each omni cube
 * into its two paraboloids (`render_forward_clustered.cpp:2722-2738`), then each spot light and each
 * area light's paraboloid (`atlasDepthPass.ts`), then each reader of the maps, and last records the
 * framebuffer height.
 */

import * as THREE from 'three';
import { AtlasOmniShadow } from './positionalShadow/atlasOmniShadow.js';
import { AtlasSpotShadow } from './positionalShadow/atlasSpotShadow.js';
import { isAreaShadowLight, type AreaShadowLight } from './positionalShadow/atlasAreaShadow.js';
import {
  drawAreaShadows,
  drawSpotShadows,
  type SpotShadowLight,
  type ThreeShadowPass,
} from './positionalShadow/atlasDepthPass.js';
import { writeFramebufferHeight } from './shadowFilter/framebufferRows.js';
import { OmniShadowCopy } from './positionalShadow/omniShadowCopy.js';
import { drawOffscreen } from './offscreen.js';

/**
 * Reads the maps a render's shadow pass has just drawn, for `scene`, the object that render draws,
 * through `camera`. A reader may render, and its renders run the pass again for their own objects.
 */
export type ShadowMapReader = (scene: THREE.Object3D, camera: THREE.Camera) => void;

/**
 * A global key for a wrapped pass's readers, kept on the renderer's shadow map. A module that a dev
 * server evaluates again finds the pass already wrapped, and adds its readers to the set that pass
 * calls. Written only by `readersOf`, `readShadowMaps` and the disposer it returns.
 */
const READERS = Symbol.for('textscene.shadowPass');

type WrappedShadowMap = THREE.WebGLShadowMap & { [READERS]?: Set<ShadowMapReader> };

interface OmniLight extends THREE.PointLight {
  shadow: AtlasOmniShadow;
}

/**
 * A shared empty answer, so a pass with nothing to copy or draw allocates nothing. A pass that copies
 * builds its own list, not a shared one: each copy is a render, which runs this pass again inside it.
 */
const NO_LIGHTS: readonly never[] = [];

/** Wraps `renderer`'s shadow pass once. A second call changes nothing. */
export function installShadowPass(renderer: THREE.WebGLRenderer): void {
  readersOf(renderer);
}

/**
 * Calls `reader` after each shadow pass of `renderer`, until the returned disposer runs. The pass
 * wraps itself on the first reader.
 */
export function readShadowMaps(renderer: THREE.WebGLRenderer, reader: ShadowMapReader): () => void {
  const readers = readersOf(renderer);
  readers.add(reader);
  return () => {
    readers.delete(reader);
  };
}

/** The readers the wrapped pass of `renderer` calls, the pass wrapped on the first call. */
function readersOf(renderer: THREE.WebGLRenderer): Set<ShadowMapReader> {
  const shadowMap = renderer.shadowMap as WrappedShadowMap;
  const existing = shadowMap[READERS];
  if (existing) return existing;
  const readers = new Set<ShadowMapReader>();
  shadowMap[READERS] = readers;
  const threePass: ThreeShadowPass = { shadowMap, draw: shadowMap.render.bind(shadowMap) };
  const copy = new OmniShadowCopy();
  shadowMap.render = (lights, scene, camera) => {
    const draws = passDraws(shadowMap);
    const copied = draws ? lightsToCopy(lights) : NO_LIGHTS;
    const spots = draws ? slottedLights(lights, isSpotShadowLight) : NO_LIGHTS;
    const areas = draws ? slottedLights(lights, isAreaShadowLight) : NO_LIGHTS;
    threePass.draw(lights, scene, camera);
    copyOmniShadows(renderer, copy, copied);
    drawSpotShadows(threePass, spots, scene, camera);
    drawAreaShadows(threePass, areas, scene, camera);
    for (const read of readers) read(scene, camera);
    // Last: each copy and each reader's render records its own target's height.
    writeFramebufferHeight(renderer);
  };
  return readers;
}

/** Copies each light's cube into the atlas, and leaves the render target as it found it. */
function copyOmniShadows(
  renderer: THREE.WebGLRenderer,
  copy: OmniShadowCopy,
  lights: readonly OmniLight[]
): void {
  if (lights.length === 0) return;
  drawOffscreen(renderer, () => {
    for (const light of lights) {
      copy.copy(renderer, light, light.shadow.slot!);
      light.shadow.writeLookupMatrix(light);
    }
  });
}

/**
 * Whether three's pass draws anything this time, read before the pass, which clears `needsUpdate`
 * (`WebGLShadowMap.js:95`, `:170`, `:370`).
 */
function passDraws(shadowMap: THREE.WebGLShadowMap): boolean {
  return shadowMap.enabled && (shadowMap.autoUpdate || shadowMap.needsUpdate);
}

/** The omni lights with a slot whose cube three's pass is about to draw. */
function lightsToCopy(lights: readonly THREE.Light[]): readonly OmniLight[] {
  let copied: OmniLight[] | null = null;
  for (const light of lights) {
    if (needsCopy(light)) (copied ??= []).push(light);
  }
  return copied ?? NO_LIGHTS;
}

function needsCopy(light: THREE.Light): light is OmniLight {
  const { shadow } = light as THREE.Light & { shadow?: unknown };
  return (
    shadow instanceof AtlasOmniShadow && shadow.slot !== null && (shadow.autoUpdate || shadow.needsUpdate)
  );
}

function isSpotShadowLight(light: THREE.Light): light is SpotShadowLight {
  return (light as { shadow?: unknown }).shadow instanceof AtlasSpotShadow;
}

/**
 * The spot or area lights that hold a slot. three's pass never draws one by itself
 * (`atlasSpotShadow.ts`, `atlasAreaShadow.ts`).
 */
function slottedLights<L extends SpotShadowLight | AreaShadowLight>(
  lights: readonly THREE.Light[],
  isKind: (light: THREE.Light) => light is L
): readonly L[] {
  let slotted: L[] | null = null;
  for (const light of lights) {
    if (isKind(light) && light.shadow.slot !== null) (slotted ??= []).push(light);
  }
  return slotted ?? NO_LIGHTS;
}
