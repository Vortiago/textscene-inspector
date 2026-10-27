/**
 * A positional light's distance fade: Godot scales the light's energy and its shadow's opacity by
 * the distance from each render's camera (`storage_rd/light_storage.cpp:840-863`, and 4.7.2
 * `:1013-1028` for an area light), so the fade applies before each render of the scene, through
 * whichever camera renders it.
 */

import { useEffect, useMemo, type RefObject } from 'react';
import type * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { distanceFade } from '../../../../godot/rendering/distanceFade';
import { LIGHT_3D_DEFAULTS } from '../../../../godot/scene/light';
import { drawnExposureRatio } from '../../../../r3f/exposure/sceneExposure';
import { cameraDistance, observeSceneCamera } from '../../../../r3f/sceneRenderCamera';
import type { PositionalLightProperties } from './types';

/** A light whose energy and shadow opacity the fade scales. */
type FadedLight = THREE.Light & { shadow: { intensity: number } };

interface LightDistanceFade {
  begin: number;
  shadow: number;
  length: number;
}

/** The light's fade, or null while `distance_fade_enabled` is off. */
function lightDistanceFade(properties: PositionalLightProperties): LightDistanceFade | null {
  if (properties.distance_fade_enabled !== true) return null;
  return {
    begin: properties.distance_fade_begin ?? LIGHT_3D_DEFAULTS.distanceFade.begin,
    shadow: properties.distance_fade_shadow ?? LIGHT_3D_DEFAULTS.distanceFade.shadow,
    length: properties.distance_fade_length ?? LIGHT_3D_DEFAULTS.distanceFade.length,
  };
}

/** What the light draws with no fade. */
interface UnfadedLight {
  intensity: number;
  shadowOpacity: number;
}

/**
 * Writes `light`'s faded intensity and shadow intensity for a render through `camera`. The energy
 * follows the exposure the scene draws at, as this write replaces the one `drawAtExposure` made.
 */
function fadeLight(
  scene: THREE.Scene,
  light: FadedLight,
  fade: LightDistanceFade,
  unfaded: UnfadedLight,
  camera: THREE.Camera
): void {
  const distance = cameraDistance(light, camera);
  light.intensity =
    unfaded.intensity * distanceFade(fade.begin, fade.length, distance) * drawnExposureRatio(scene);
  light.shadow.intensity = unfaded.shadowOpacity * distanceFade(fade.shadow, fade.length, distance);
}

/**
 * Fades the light in `lightRef` before each render of its scene while `properties` turn the fade
 * on, and restores `unfaded` when the fade ends.
 */
export function useLightDistanceFade(
  lightRef: RefObject<FadedLight | null>,
  properties: PositionalLightProperties,
  { intensity, shadowOpacity }: UnfadedLight
): void {
  const scene = useThree((state) => state.scene);
  const fade = useMemo(() => lightDistanceFade(properties), [properties]);

  useEffect(() => {
    const light = lightRef.current;
    if (!light || !fade) return undefined;
    const unfaded = { intensity, shadowOpacity };
    const stop = observeSceneCamera(scene, (camera) => fadeLight(scene, light, fade, unfaded, camera));
    return () => {
      stop();
      light.intensity = intensity;
      light.shadow.intensity = shadowOpacity;
    };
  }, [scene, lightRef, fade, intensity, shadowOpacity]);
}
