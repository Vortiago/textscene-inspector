/**
 * `<SkyLayer>`: mounts a Godot sky as the scene's background and IBL. Godot's sky
 * shader draws the first four DirectionalLights' discs as `LIGHT0..3`, so the lights
 * are read from the rendered three.js scene, where an instanced or GLB light has
 * its real world transform.
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { SkyProperties } from '../../resources/sky/types';
import { useTexture2D } from '../../resources/useTexture2D';
import { useSceneResources } from '../SceneResourcesContext';
import { buildSkyEnvironment, type SkyLight } from '../../resources/sky/build';
import { LIGHT_INTENSITY_SCALE } from '../lightConstants';

export interface SkyLayerProps {
  sky: SkyProperties;
  /**
   * The sky's full reflection strength (`background_energy_multiplier`), as
   * `scene.environmentIntensity`: a metal reflects the whole sky whatever the
   * ambient source. `EnvironmentLayer` restores the diffuse share with `envMapIntensity`.
   */
  intensity?: number;
  /**
   * Whether this sky also paints the background. Godot's ambient can come from
   * the sky while the background shows something else (`AMBIENT_SOURCE_SKY`
   * over a colour background).
   */
  asBackground?: boolean;
  /**
   * Godot's `background_energy_multiplier` applied to the drawn sky, so a doubled
   * multiplier brightens the sky as well as the surfaces it lights.
   */
  backgroundIntensity?: number;
}

/** Godot's sky shader has four light slots. The other lights do not reach it. */
const LIGHT_SLOTS = 4;

export function SkyLayer({
  sky,
  intensity = 1,
  asBackground = true,
  backgroundIntensity = 1,
}: SkyLayerProps) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const { externalResources, internalResources } = useSceneResources();

  // `useTexture2D`, not the path-only resolver: a PanoramaSkyMaterial's
  // equirectangular texture may be an inline procedural one (a
  // GradientTexture2D sub-resource), which has no path to load from. Every
  // other sky kind passes `undefined` and the hook idles.
  const panorama =
    useTexture2D(
      sky.kind === 'panorama' ? sky.panorama : undefined,
      externalResources,
      internalResources
    ).texture ?? null;
  const lightsKey = useSkyLightsKey(scene);

  useEffect(() => {
    // No frame has read the lights yet. A bake now would be replaced before it
    // is seen, and each bake costs a six-face cube render and a PMREM prefilter.
    if (lightsKey === null) return undefined;

    const built = buildSkyEnvironment(gl, {
      sky,
      lights: directionalLights(scene),
      panorama,
    });
    if (!built) return undefined;

    const previousEnvironment = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    const previousBackground = scene.background;
    const previousBackgroundIntensity = scene.backgroundIntensity;

    scene.environment = built.environment;
    scene.environmentIntensity = intensity;
    if (asBackground) {
      scene.background = built.background;
      scene.backgroundIntensity = backgroundIntensity;
    }

    return () => {
      scene.environment = previousEnvironment;
      scene.environmentIntensity = previousIntensity;
      if (asBackground) {
        scene.background = previousBackground;
        scene.backgroundIntensity = previousBackgroundIntensity;
      }
      built.dispose();
    };
  }, [
    gl,
    scene,
    sky,
    intensity,
    panorama,
    asBackground,
    backgroundIntensity,
    lightsKey,
  ]);

  return null;
}

/**
 * Changes whenever the lights the sky draws change, read every frame, as Godot re-renders the sky
 * on a change of light count, direction, energy, colour or size (`sky.cpp:1104-1142`). A sub-scene
 * or GLB brings a light late, and the preview sun unmounts for the scene's own (ADR-0025). Null
 * until the first frame.
 */
function useSkyLightsKey(scene: THREE.Scene): string | null {
  const [key, setKey] = useState<string | null>(null);
  const latest = useRef<string | null>(null);
  useFrame(() => {
    const next = skyLightsKey(directionalLights(scene));
    if (next === latest.current) return;
    latest.current = next;
    setKey(next);
  });
  return key;
}

function skyLightsKey(lights: readonly SkyLight[]): string {
  return lights
    .map(({ direction: d, color: c, energy, angularRadius }) =>
      [d.x, d.y, d.z, c.r, c.g, c.b, energy, angularRadius].join(',')
    )
    .join(';');
}

/**
 * The scene's directional lights, as Godot's sky shader wants them: the
 * direction towards the light (where its disc appears), its colour, and its
 * energy. three's `DirectionalLight` shines from its own world position toward
 * its target's, so the sky direction is that vector reversed.
 */
function directionalLights(scene: THREE.Scene): SkyLight[] {
  const lights: SkyLight[] = [];
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();

  scene.traverse((object) => {
    if (lights.length >= LIGHT_SLOTS) return;
    if (!(object as THREE.DirectionalLight).isDirectionalLight) return;
    // `traverse` descends into hidden subtrees, which three skips when lighting.
    // Godot's sky sees only the render list, so a hidden light draws no disc.
    if (!isRendered(object)) return;
    const light = object as THREE.DirectionalLight;

    light.getWorldPosition(from);
    light.target.getWorldPosition(to);
    const direction = from.clone().sub(to);
    if (direction.lengthSq() === 0) direction.set(0, 1, 0);

    lights.push({
      direction: direction.normalize(),
      color: light.color.clone(),
      // Back to Godot's `light_energy`: `sky.cpp` sets `sky_light_data.energy`
      // from LIGHT_PARAM_ENERGY with no PI, unlike the scene shader. Every light
      // this renderer creates goes through the scale. A GLB `KHR_lights_punctual`
      // light does not, so its disc reads 1/PI dim.
      energy: light.intensity / LIGHT_INTENSITY_SCALE,
      // `light_angular_distance` defaults to 0: a point sun with only the soft
      // falloff `sun_curve` gives it.
      angularRadius: 0,
    });
  });

  return lights;
}

/** Visible, and not buried under a hidden ancestor. */
function isRendered(object: THREE.Object3D): boolean {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) {
    if (!node.visible) return false;
  }
  return true;
}
