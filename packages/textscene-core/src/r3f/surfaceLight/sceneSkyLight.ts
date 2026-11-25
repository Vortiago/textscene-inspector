import * as THREE from 'three';
import type { SceneSky } from '../../shaders/spatial/sceneSky.js';
import { uvBorderSizeOf } from '../../shaders/sky/skyBindings.js';
import { renderedSky, skyRotation, type ShownSky } from '../sky/skyRadiance.js';

/** Written only by `sceneSkyLight`, cleared by a draw with no sky. `show` makes a new record each render. */
let last: { readonly shown: ShownSky; readonly light: SceneSky } | null = null;

/** The sky of the render under way as a lit surface reads it, or nothing when the render shows none. */
export function sceneSkyLight(): SceneSky | undefined {
  const shown = renderedSky();
  if (!shown) {
    last = null;
    return undefined;
  }
  if (last?.shown !== shown) last = { shown, light: lightOf(shown) };
  return last.light;
}

function lightOf(sky: ShownSky): SceneSky {
  const { layout, target } = sky.layers;
  return {
    layers: target.texture,
    layerEnergies: sky.energies,
    pixelSize: layout.pixelSize,
    borderSize: uvBorderSizeOf(layout.borderSize),
    worldToSky: new THREE.Matrix3().fromArray(skyRotation),
    energyMultiplier: sky.energyMultiplier,
    ambientContribution: sky.contribution,
    isAmbientSource: sky.isAmbientSource,
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
