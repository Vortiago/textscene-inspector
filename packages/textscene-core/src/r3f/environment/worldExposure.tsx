/**
 * The exposure of a world: the CameraAttributes of the camera it renders through, else those of its
 * first valid WorldEnvironment, which chooses apart from the Environment (`world_environment.cpp:87-93`).
 * Godot scales the frame by the attributes' exposure normalisation factor, which this code calls the
 * exposure factor. It is the `exposure_multiplier` while the project uses no physical light units
 * (`camera_attributes_storage.cpp:133-138`, `camera_attributes.cpp:56-64`).
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { CameraAttributes } from '../../resources/cameraattributes/types';
import { electViewportCamera } from '../../godot/scene/camera3d';
import { useOptionalViewportActions } from '../contexts/ViewportActionsContext';
import { useSceneExposure } from '../exposure/sceneExposure';
import { useWorldKind, type WorldKind } from './WorldKindContext';
import { createWorldGroup, createWorldPublications, type WorldResolution } from './worldGroup';

/** What a WorldEnvironment's `camera_attributes` resolves to, when it holds a valid one. */
export type CameraAttributesResolution = WorldResolution<{ attributes: CameraAttributes }>;

const cameraAttributes = createWorldGroup<{ attributes: CameraAttributes }>();

export const usePublishCameraAttributes = cameraAttributes.usePublish;

/** A Camera3D of the world, whether or not the world renders through it. */
interface WorldCamera {
  path: string;
  current: boolean;
  attributes: CameraAttributesResolution;
}

const cameras = createWorldPublications<WorldCamera>();

/**
 * Puts a Camera3D and the `attributes` it holds in its world. A Camera3D rendered alone, outside
 * any world, has no viewport to render through it and publishes nowhere.
 */
export function usePublishRenderCamera(
  path: string,
  current: boolean,
  attributes: CameraAttributesResolution
): void {
  cameras.usePublishIfInWorld(useMemo(() => ({ path, current, attributes }), [path, current, attributes]));
}

/**
 * The camera `world` renders through. The root viewport renders through the camera the viewer
 * looks through, and none in the free view, whose editor camera holds no attributes. A sub-viewport
 * elects one of its own (`electViewportCamera`).
 */
function renderCameraOf(
  world: WorldKind,
  viewedPath: string | null,
  worldCameras: readonly WorldCamera[]
): WorldCamera | null {
  if (world === 'subViewport') return electViewportCamera(worldCameras);
  return worldCameras.find((camera) => camera.path === viewedPath) ?? null;
}

/** Null with no valid CameraAttributes, which Godot's frame does not scale at all. */
const ExposureContext = createContext<number | null>(null);

/** Chooses the world's CameraAttributes and gives its readers the exposure. One per world. */
export function WorldExposureScope({ children }: { children: ReactNode }) {
  return (
    <cameraAttributes.Provider>
      <cameras.Provider>
        <ExposureProvider>{children}</ExposureProvider>
      </cameras.Provider>
    </cameraAttributes.Provider>
  );
}

function ExposureProvider({ children }: { children: ReactNode }) {
  const world = useWorldKind();
  const viewedPath = useOptionalViewportActions()?.activeCameraPath ?? null;
  const renderCamera = renderCameraOf(world, viewedPath, cameras.useAll());
  const worldAttributes = cameraAttributes.useChosen();
  // A camera's valid attributes replace the world's: Godot forces them over the scenario's
  // (`renderer_scene_cull.cpp:3562-3565`), and a pending `.tres` holds the place of a valid one.
  const chosen =
    renderCamera && renderCamera.attributes.status !== 'none' ? renderCamera.attributes : worldAttributes;
  const optionalFactor = chosen?.status === 'resolved' ? chosen.attributes.exposureMultiplier : null;
  useSceneExposure(optionalFactor);
  return <ExposureContext.Provider value={optionalFactor}>{children}</ExposureContext.Provider>;
}

/**
 * The world's exposure factor, or null without CameraAttributes. A lightmap needs the
 * difference: with no attributes it reads 1, not the factor over its baked exposure
 * (`render_forward_clustered.cpp:1222-1229`).
 */
export function useOptionalExposureFactor(): number | null {
  return useContext(ExposureContext);
}

/** The factor a consumer scales by: 1 without CameraAttributes. */
export function useExposureFactor(): number {
  return useOptionalExposureFactor() ?? 1;
}
