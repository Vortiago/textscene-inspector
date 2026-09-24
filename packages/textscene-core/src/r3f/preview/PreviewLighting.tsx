/**
 * `<PreviewLighting>`: Godot's editor preview sun and environment, each mounted
 * only while the scene supplies none (ADR-0025). It reads the live tree, so a
 * node inside an instanced sub-scene counts, as in Godot's editor.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useViewportMode } from '../contexts/ViewportModeContext';
import { useLiveSceneNodes } from '../useLiveSceneTree';
import { EnvironmentLayer } from '../environment/EnvironmentLayer';
import {
  LIGHT_INTENSITY_SCALE,
  DEFAULT_SHADOW_BIAS,
  DIRECTIONAL_SHADOW_FRUSTUM_HALF,
  DIRECTIONAL_SHADOW_NEAR,
  SHADOW_MAP_SIZE,
  SHADOW_NORMAL_BIAS,
} from '../lightConstants';
import {
  PREVIEW_SUN_COLOR,
  PREVIEW_SUN_ENERGY,
  PREVIEW_SUN_SHADOW_MAX_DISTANCE,
  YIELDS_A_PREVIEW,
  previewEnvironment,
  previewSunDirection,
  previewYield,
} from './godotPreviewLighting';


/**
 * Where the preview sun stands. It has no scene node, so unlike an authored
 * light nothing is anchored to its transform and the distance is free; the
 * direction it lights from is what this encodes.
 */
const PREVIEW_SUN_DISTANCE = 30;

export function PreviewLighting() {
  const { showPreviewSun, showPreviewEnvironment } = useViewportMode();
  const yielding = useLiveSceneNodes(YIELDS_A_PREVIEW);

  const decision = useMemo(
    () =>
      previewYield(
        yielding.map((entry) => entry.node.type),
        { sun: showPreviewSun, environment: showPreviewEnvironment }
      ),
    [yielding, showPreviewSun, showPreviewEnvironment]
  );

  return (
    <>
      {decision.sun && <PreviewSun />}
      {decision.environment && <PreviewEnvironment />}
    </>
  );
}

/**
 * Godot's preview sun: a white, energy-1.0 DirectionalLight3D with shadows on.
 * Built from the same constants an authored `<DirectionalLight3D>` uses, so a
 * scene does not visibly change character the moment it gains its own sun.
 */
function PreviewSun() {
  const target = useMemo(() => new THREE.Object3D(), []);
  // A tuple, not a Vector3: R3F assigns an object-valued `position` straight
  // onto the instance, and `Object3D.position` has no setter.
  const position = useMemo((): [number, number, number] => {
    const { x, y, z } = previewSunDirection().multiplyScalar(-PREVIEW_SUN_DISTANCE);
    return [x, y, z];
  }, []);

  return (
    <>
      <primitive object={target} />
      <directionalLight
        position={position}
        target={target}
        color={PREVIEW_SUN_COLOR}
        intensity={PREVIEW_SUN_ENERGY * LIGHT_INTENSITY_SCALE}
        castShadow
        shadow-mapSize-width={SHADOW_MAP_SIZE}
        shadow-mapSize-height={SHADOW_MAP_SIZE}
        shadow-bias={DEFAULT_SHADOW_BIAS.DIRECTIONAL}
        shadow-normalBias={SHADOW_NORMAL_BIAS}
        shadow-camera-near={DIRECTIONAL_SHADOW_NEAR}
        shadow-camera-far={PREVIEW_SUN_SHADOW_MAX_DISTANCE}
        shadow-camera-left={-DIRECTIONAL_SHADOW_FRUSTUM_HALF}
        shadow-camera-right={DIRECTIONAL_SHADOW_FRUSTUM_HALF}
        shadow-camera-top={DIRECTIONAL_SHADOW_FRUSTUM_HALF}
        shadow-camera-bottom={-DIRECTIONAL_SHADOW_FRUSTUM_HALF}
      />
    </>
  );
}

/** Godot's preview environment, applied through the same layer an authored one uses. */
function PreviewEnvironment() {
  const { settings, sky } = useMemo(() => previewEnvironment(), []);
  return <EnvironmentLayer settings={settings} sky={sky} />;
}
