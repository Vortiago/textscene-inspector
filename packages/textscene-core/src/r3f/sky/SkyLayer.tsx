/**
 * `<SkyLayer>` — mounts a Godot sky as the scene's background and IBL.
 *
 * Godot's sky shader takes the scene's first four DirectionalLights as
 * `LIGHT0..3` and draws their discs into the sky itself, so the sky depends on
 * the lighting rather than the other way round. The lights are read from the
 * rendered three.js scene (not from parsed nodes) so that a light's real world
 * transform is used, whatever produced it — an authored node, an instanced
 * sub-scene, or a GLB.
 */

import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { SkyProperties } from '../../resources/sky/types';
import { useResource, useResourceLoader } from '../../resources/useResource';
import { resolveTexture2DPath } from '../../resources/SubResourceResolver';
import { useSceneResources } from '../SceneResourcesContext';
import { useLiveTreeVersion } from '../useLiveSceneTree';
import { buildSkyEnvironment } from './skyEnvironment';
import { LIGHT_INTENSITY_SCALE } from '../lightConstants';
import type { SkyLight } from './skyUniforms';

export interface SkyLayerProps {
  sky: SkyProperties;
  /** Godot's ambient energy → `scene.environmentIntensity`. */
  intensity?: number;
  /**
   * Whether this sky also paints the background. Godot's ambient can come from
   * the sky while the background shows something else (`AMBIENT_SOURCE_SKY`
   * over a colour background).
   */
  asBackground?: boolean;
  /**
   * Godot's `background_energy_multiplier` applied to the DRAWN sky. It scales
   * what the sky lights (through `intensity`) and what it looks like alike, so
   * without this a doubled multiplier brightened every surface while the sky
   * behind them stayed put.
   */
  backgroundIntensity?: number;
}

/** Godot's sky shader has four light slots; the rest of the scene's lights don't reach it. */
const LIGHT_SLOTS = 4;

export function SkyLayer({
  sky,
  intensity = 1,
  asBackground = true,
  backgroundIntensity = 1,
}: SkyLayerProps) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const loader = useResourceLoader();
  const { externalResources, internalResources } = useSceneResources();

  // A PanoramaSkyMaterial's equirectangular texture is an ordinary
  // ExtResource; every other sky kind resolves to no path and the hook idles.
  const panoramaPath = useMemo(
    () =>
      sky.kind === 'panorama' && sky.panorama
        ? resolveTexture2DPath(sky.panorama, externalResources, internalResources)
        : null,
    [sky, externalResources, internalResources]
  );
  const panorama = useResource<THREE.Texture>(panoramaPath ?? '', 'Texture2D').value ?? null;
  // The live tree GROWS as sub-scenes and GLBs load, and a light arriving late
  // changes the sky. This is the same tick every other live-tree reader uses.
  const treeVersion = useLiveTreeVersion(loader);

  // Re-render once after mount so the first pass sees sibling lights: child
  // effects run before the parent's, but the very first paint happens before
  // any of them.
  const [pass, setPass] = useState(0);
  useEffect(() => setPass(1), []);

  useEffect(() => {
    // Nothing built on the first pass would ever be seen: the corrective pass
    // below follows in the same tick and disposes it. Building anyway cost a
    // six-face cube render and a PMREM prefilter on every mount, and the
    // preview environment puts a SkyLayer in nearly every 3D scene.
    if (pass === 0) return undefined;

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
    treeVersion,
    pass,
  ]);

  return null;
}

/**
 * The scene's directional lights, as Godot's sky shader wants them: the
 * direction TOWARDS the light (where its disc appears), its colour, and its
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
    // `traverse` descends into hidden subtrees, but three's renderer skips them
    // when lighting — and Godot's sky only sees lights in the render list, so a
    // `visible = false` light draws no disc there either.
    if (!isRendered(object)) return;
    const light = object as THREE.DirectionalLight;

    light.getWorldPosition(from);
    light.target.getWorldPosition(to);
    const direction = from.clone().sub(to);
    if (direction.lengthSq() === 0) direction.set(0, 1, 0);

    lights.push({
      direction: direction.normalize(),
      color: light.color.clone(),
      // Back to Godot's `light_energy`. The sky is the one consumer that must
      // NOT see three's scaled intensity: Godot's sky shader is fed the raw
      // energy (`sky.cpp` sets `sky_light_data.energy` from LIGHT_PARAM_ENERGY
      // with no PI), while the scene shader gets the PI-multiplied one. Passing
      // `light.intensity` straight through made the sun disc PI times too
      // bright, and PMREM then fed that error back into the IBL.
      energy: light.intensity / LIGHT_INTENSITY_SCALE,
      // Assumes the light came through `LIGHT_INTENSITY_SCALE`, which every
      // light this renderer creates does. A light arriving inside a GLB
      // (KHR_lights_punctual) never did, and its disc would read 1/PI dim.
      // `light_angular_distance` defaults to 0 — a point sun with only the
      // soft falloff `sun_curve` gives it.
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
