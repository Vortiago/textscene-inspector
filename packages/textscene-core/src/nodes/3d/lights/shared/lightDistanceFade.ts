/**
 * An omni or spot light's distance fade: Godot scales the light's energy and its shadow's opacity
 * by the distance from each render's camera (`storage_rd/light_storage.cpp:840-863`), so the fade
 * applies before each render of the scene, through whichever camera renders it.
 */

import { useEffect, useMemo, type RefObject } from 'react';
import type * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { LIGHT_DISTANCE_FADE_DEFAULT, distanceFade } from '../../../../godot/distanceFade';
import { cameraDistance, observeSceneCamera } from '../../../../r3f/sceneRenderCamera';
import type { PositionalLightProperties } from './types';

interface LightDistanceFade {
  begin: number;
  shadow: number;
  length: number;
}

/** The light's fade, or null while `distance_fade_enabled` is off. */
function lightDistanceFade(properties: PositionalLightProperties): LightDistanceFade | null {
  if (properties.distance_fade_enabled !== true) return null;
  return {
    begin: properties.distance_fade_begin ?? LIGHT_DISTANCE_FADE_DEFAULT.begin,
    shadow: properties.distance_fade_shadow ?? LIGHT_DISTANCE_FADE_DEFAULT.shadow,
    length: properties.distance_fade_length ?? LIGHT_DISTANCE_FADE_DEFAULT.length,
  };
}

/** What the light draws with no fade. */
interface UnfadedLight {
  intensity: number;
  shadowOpacity: number;
}

/** Writes `light`'s faded intensity and shadow intensity for a render through `camera`. */
function fadeLight(
  light: THREE.PointLight | THREE.SpotLight,
  fade: LightDistanceFade,
  unfaded: UnfadedLight,
  camera: THREE.Camera
): void {
  const distance = cameraDistance(light, camera);
  light.intensity = unfaded.intensity * distanceFade(fade.begin, fade.length, distance);
  light.shadow.intensity = unfaded.shadowOpacity * distanceFade(fade.shadow, fade.length, distance);
}

/**
 * Fades the light in `lightRef` before each render of its scene while `properties` turn the fade
 * on, and restores `unfaded` when the fade ends.
 */
export function useLightDistanceFade(
  lightRef: RefObject<THREE.PointLight | THREE.SpotLight | null>,
  properties: PositionalLightProperties,
  { intensity, shadowOpacity }: UnfadedLight
): void {
  const scene = useThree((state) => state.scene);
  const fade = useMemo(() => lightDistanceFade(properties), [properties]);

  useEffect(() => {
    const light = lightRef.current;
    if (!light || !fade) return undefined;
    const unfaded = { intensity, shadowOpacity };
    const stop = observeSceneCamera(scene, (camera) => fadeLight(light, fade, unfaded, camera));
    return () => {
      stop();
      light.intensity = intensity;
      light.shadow.intensity = shadowOpacity;
    };
  }, [scene, lightRef, fade, intensity, shadowOpacity]);
}
