/**
 * `<SkyLayer>`: mounts a Godot sky as the scene's background and IBL, and shows its baked layers and
 * its share of the ambient to every lit material before each render of the scene
 * (`skyLayerArray.ts`). Godot's sky shader draws the discs of the first four DirectionalLights that
 * are not Light Only as `LIGHT0..3`. The lights are read from the rendered three.js scene, where an
 * instanced or GLB light has its real world transform. The world's exposure scales the sky as Godot
 * does: the background and each disc once, and the ambient and the reflection twice, since Godot
 * bakes the radiance at the exposure and a surface reads it at the exposure again
 * (`render_forward_clustered.cpp:1993`, `render_scene_data_rd.cpp:241-246`, `sky.cpp:1086`).
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { visibleInTree } from '../visibleInTree';
import { useFrame, useThree } from '@react-three/fiber';
import type { Sky } from '../../resources/sky/types';
import { useTexture2D } from '../../resources/useTexture2D';
import type { SceneResources } from '../SceneResourcesContext';
import { buildSkyEnvironment, type SkyLight } from '../../resources/sky/build';
import { skyLightEnergy, skyLightSize } from './skyLight';
import { skyEuler } from './skyRotation';
import { SkyLayerArray } from './skyLayerArray';
import { observeSceneCamera } from '../sceneRenderCamera';
import { useExposureFactor } from '../environment/worldExposure';
import { registerExposureStage } from '../exposure/sceneExposure';
import { debandSky } from './skyDebanding';
import { isDebanded } from '../../resources/sky/debanding';
import type { Vector3 } from '../../godot/math/vector';

interface SkyLayerProps {
  sky: Sky;
  /**
   * The sky's full reflection strength (`background_energy_multiplier`), as
   * `scene.environmentIntensity`: a surface reflects the whole sky whatever the
   * ambient source.
   */
  intensity?: number;
  /**
   * `ambient_light_sky_contribution`: the sky's share of the ambient, 0 when the ambient
   * comes from elsewhere.
   */
  contribution?: number;
  /**
   * Whether this sky also paints the background. Godot's ambient can come from
   * the sky while the background shows something else (`AmbientSource.SKY`
   * over a colour background).
   */
  asBackground?: boolean;
  /**
   * Godot's `background_energy_multiplier` applied to the drawn sky, so a doubled
   * multiplier brightens the sky as well as the surfaces it lights.
   */
  backgroundIntensity?: number;
  /** `sky_rotation`, which turns the background and the light the sky gives. */
  rotation: Vector3;
  /** The pools the sky material's references, such as a panorama, resolve in. */
  resources: SceneResources;
}

/** Godot's sky shader has four light slots. The other lights do not reach it. */
const LIGHT_SLOTS = 4;

export function SkyLayer({
  sky,
  intensity = 1,
  contribution = 1,
  asBackground = true,
  backgroundIntensity = 1,
  rotation,
  resources,
}: SkyLayerProps) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const exposure = useExposureFactor();

  // The panorama sky samples `source_panorama` as `source_color` (`sky_material.cpp:498`).
  // Every other sky kind passes `undefined` and the hook idles.
  const panorama =
    useTexture2D(
      sky.material.kind === 'panorama' ? sky.material.panorama : undefined,
      resources.externalResources,
      resources.internalResources,
      'decoding'
    ).texture ?? null;
  const lightsKey = useSkyLightsKey(scene);
  const contextRestores = useContextRestores(gl);
  const { x: rotationX, y: rotationY, z: rotationZ } = rotation;
  // A ref, not an effect dependency: a new share needs no new bake.
  const contributionRef = useRef(contribution);
  contributionRef.current = contribution;

  useEffect(() => {
    // No frame has read the lights yet. A bake now would be replaced before it
    // is seen, and each bake costs a six-face cube render, the layer passes and a
    // PMREM prefilter.
    if (lightsKey === null) return undefined;

    const built = buildSkyEnvironment(gl, {
      sky,
      lights: directionalLights(scene).map((light) => ({ ...light, energy: light.energy * exposure })),
      panorama,
      asBackground,
      energy: intensity * exposure,
    });
    if (!built) return undefined;

    const previousEnvironment = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    const previousBackground = scene.background;
    const previousBackgroundIntensity = scene.backgroundIntensity;
    const previousEnvironmentRotation = scene.environmentRotation.clone();
    const previousBackgroundRotation = scene.backgroundRotation.clone();
    const skyRotation = skyEuler({ x: rotationX, y: rotationY, z: rotationZ });

    // The radiance is baked at the exposure of the view, and a surface reads it at the exposure it
    // draws at. A draw at another exposure keeps the bake, as Godot rebakes a layer at a time
    // (`sky.cpp`, `update_radiance_buffers`).
    const exposeAs = (factor: number) => {
      scene.environmentIntensity = intensity * exposure * factor;
      if (asBackground) scene.backgroundIntensity = backgroundIntensity * factor;
    };
    scene.environment = built.environment;
    scene.environmentRotation.copy(skyRotation);
    const layerArray = new SkyLayerArray(gl, built.layers);
    // Observed, not assigned: the visibility cull and the shadow fitter share the scene's hook.
    const stopShowingLayers = observeSceneCamera(scene, () => layerArray.show(contributionRef.current));
    if (asBackground) {
      scene.background = built.background;
      scene.backgroundRotation.copy(skyRotation);
    }
    exposeAs(exposure);
    const stopStaging = registerExposureStage(scene, (target) => {
      exposeAs(target ?? 1);
      return () => exposeAs(exposure);
    });
    const stopDebanding = asBackground && isDebanded(sky.material) ? debandSky(gl, scene) : undefined;

    return () => {
      stopStaging();
      stopShowingLayers();
      stopDebanding?.();
      scene.environment = previousEnvironment;
      scene.environmentIntensity = previousIntensity;
      scene.environmentRotation.copy(previousEnvironmentRotation);
      if (asBackground) {
        scene.background = previousBackground;
        scene.backgroundIntensity = previousBackgroundIntensity;
        scene.backgroundRotation.copy(previousBackgroundRotation);
      }
      layerArray.hide();
      built.dispose();
    };
  }, [
    gl,
    scene,
    sky,
    intensity,
    exposure,
    panorama,
    asBackground,
    backgroundIntensity,
    lightsKey,
    contextRestores,
    rotationX,
    rotationY,
    rotationZ,
  ]);

  return null;
}

/**
 * Counts the contexts `gl` restores. A lost context loses every texture the bake drew, and the bake
 * keeps nothing on the CPU to upload again, so the sky bakes again on each.
 */
function useContextRestores(gl: THREE.WebGLRenderer): number {
  const [restores, setRestores] = useState(0);
  useEffect(() => {
    const restored = () => setRestores((count) => count + 1);
    gl.domElement.addEventListener('webglcontextrestored', restored);
    return () => gl.domElement.removeEventListener('webglcontextrestored', restored);
  }, [gl]);
  return restores;
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
    .map(({ direction: d, color: c, energy, size }) => [d.x, d.y, d.z, c.r, c.g, c.b, energy, size].join(','))
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
    if (!visibleInTree(object)) return;
    const light = object as THREE.DirectionalLight;
    const energy = skyLightEnergy(light);
    if (energy === null) return;

    light.getWorldPosition(from);
    light.target.getWorldPosition(to);
    const direction = from.clone().sub(to);
    if (direction.lengthSq() === 0) direction.set(0, 1, 0);

    lights.push({
      direction: direction.normalize(),
      color: light.color.clone(),
      // `sky.cpp` sets `sky_light_data.energy` from LIGHT_PARAM_ENERGY with no PI,
      // unlike the scene shader.
      energy,
      size: skyLightSize(light),
    });
  });

  return lights;
}
