/**
 * An omni, spot or area light's distance fade: Godot scales the light's energy and its shadow's
 * opacity by the distance from each render's camera (`storage_rd/light_storage.cpp:840-863`, and
 * 4.7.2 `:1012-1029` for the area light), so the fade applies before each render of the scene,
 * through whichever camera renders it.
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

/** A light Godot fades by distance. */
type FadingLight = THREE.PointLight | THREE.SpotLight | THREE.RectAreaLight;

/** What the light draws with no fade. An area light has no shadow, so it passes no opacity. */
interface UnfadedLight {
  intensity: number;
  shadowOpacity?: number;
}

function writeLight(light: FadingLight, intensity: number, shadowOpacity: number): void {
  light.intensity = intensity;
  if ('shadow' in light) light.shadow.intensity = shadowOpacity;
}

/** Writes `light`'s faded intensity and shadow intensity for a render through `camera`. */
function fadeLight(
  light: FadingLight,
  fade: LightDistanceFade,
  { intensity, shadowOpacity }: Required<UnfadedLight>,
  camera: THREE.Camera
): void {
  const distance = cameraDistance(light, camera);
  writeLight(
    light,
    intensity * distanceFade(fade.begin, fade.length, distance),
    shadowOpacity * distanceFade(fade.shadow, fade.length, distance)
  );
}

/**
 * Fades the light in `lightRef` before each render of its scene while `properties` turn the fade
 * on, and restores `unfaded` when the fade ends.
 */
export function useLightDistanceFade(
  lightRef: RefObject<FadingLight | null>,
  properties: PositionalLightProperties,
  { intensity, shadowOpacity = 0 }: UnfadedLight
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
      writeLight(light, intensity, shadowOpacity);
    };
  }, [scene, lightRef, fade, intensity, shadowOpacity]);
}
