import * as THREE from 'three';
import type { SceneSky } from '../../shaders/spatial/sceneSky.js';
import { renderedSky, skyRotation } from '../sky/skyRadiance.js';

/** Scratch for one draw's sky basis, overwritten by the next. */
const worldToSky = new THREE.Matrix3();

/** The sky of the render under way as a lit surface reads it, or nothing when the render shows none. */
export function sceneSkyLight(): SceneSky | undefined {
  const sky = renderedSky();
  if (!sky) return undefined;
  const { layout, target } = sky.layers;
  return {
    layers: target.texture,
    layerEnergies: sky.energies,
    pixelSize: layout.pixelSize,
    // The layout keeps the width inside the padding, and Godot the padding of one side (`sky.cpp:1559`).
    borderSize: (1 - layout.borderSize) / 2,
    worldToSky: worldToSky.fromArray(skyRotation),
    energyMultiplier: sky.energyMultiplier,
    ambientContribution: sky.contribution,
    isReflected: sky.isReflected,
  };
}

/** The flat light before the sky takes its share, which `scene_forward_clustered.glsl:1756` mixes. */
export function unmixedAmbientLight(
  ambientLight: THREE.Color,
  sky: SceneSky | undefined,
  target: THREE.Color
): THREE.Color {
  const flatShare = 1 - (sky?.ambientContribution ?? 0);
  // With all of the ambient from the sky, the flat light is never read.
  return flatShare > 0 ? target.copy(ambientLight).multiplyScalar(1 / flatShare) : target.setRGB(0, 0, 0);
}
