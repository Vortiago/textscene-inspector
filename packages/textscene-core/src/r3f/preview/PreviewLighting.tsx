/**
 * `<PreviewLighting>` — Godot's editor preview sun and preview environment,
 * each mounted only while the scene does not supply its own (ADR-0025).
 *
 * The scene is inspected through the LIVE tree, so a `DirectionalLight3D` or
 * `WorldEnvironment` inside an instanced sub-scene counts exactly as it does in
 * Godot's editor, where those nodes really are children of the scene root.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useViewportMode } from '../contexts/ViewportModeContext';
import { useLiveSceneNodes } from '../useLiveSceneTree';
import { EnvironmentLayer } from '../environment/EnvironmentLayer';
import { LIGHT_INTENSITY_SCALE, DEFAULT_SHADOW_BIAS } from '../lightConstants';
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
 * How far back the preview sun sits. Directional light is parallel, so this
 * only has to keep the shadow frustum in front of the scene.
 */
const PREVIEW_SUN_DISTANCE = 30;
const PREVIEW_SUN_SHADOW_FRUSTUM_HALF = 20;

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
        shadow-bias={DEFAULT_SHADOW_BIAS.DIRECTIONAL}
        shadow-camera-near={0.1}
        shadow-camera-far={PREVIEW_SUN_SHADOW_MAX_DISTANCE}
        shadow-camera-left={-PREVIEW_SUN_SHADOW_FRUSTUM_HALF}
        shadow-camera-right={PREVIEW_SUN_SHADOW_FRUSTUM_HALF}
        shadow-camera-top={PREVIEW_SUN_SHADOW_FRUSTUM_HALF}
        shadow-camera-bottom={-PREVIEW_SUN_SHADOW_FRUSTUM_HALF}
      />
    </>
  );
}

/** Godot's preview environment, applied through the same layer an authored one uses. */
function PreviewEnvironment() {
  const { settings, sky } = useMemo(() => previewEnvironment(), []);
  return <EnvironmentLayer settings={settings} sky={sky} />;
}
