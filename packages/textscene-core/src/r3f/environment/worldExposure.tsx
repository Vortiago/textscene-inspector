/**
 * The exposure of a world: the CameraAttributes of the camera it renders through, else those of its
 * first valid WorldEnvironment, which chooses apart from the Environment (`world_environment.cpp:87-93`).
 * Godot scales the frame by the attributes' exposure normalisation factor, which this code calls the
 * exposure factor. It is the `exposure_multiplier` while the project uses no physical light units
 * (`camera_attributes_storage.cpp:133-138`, `camera_attributes.cpp:56-64`). The camera it elects
 * gives its Environment to the world's chooser too (`WorldEnvironmentScope.tsx`).
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { AutoExposure, CameraAttributes } from '../../resources/cameraattributes/types';
import { electViewportCamera } from '../../godot/scene/camera3d';
import { useOptionalViewportActions } from '../contexts/ViewportActionsContext';
import { useSceneExposure } from '../exposure/sceneExposure';
import { useWorldKind, type WorldKind } from './WorldKindContext';
import { createWorldGroup, createWorldPublications, type WorldResolution } from './worldGroup';
import type { EnvironmentResolution } from './WorldEnvironmentScope';

/** What a WorldEnvironment's `camera_attributes` resolves to, when it holds a valid one. */
export type CameraAttributesResolution = WorldResolution<{ attributes: CameraAttributes }>;

const cameraAttributes = createWorldGroup<{ attributes: CameraAttributes }>();

export const usePublishCameraAttributes = cameraAttributes.usePublish;

/** What a Camera3D holds that replaces its world's own while a viewport renders through it. */
export interface CameraResources {
  attributes: CameraAttributesResolution;
  environment: EnvironmentResolution;
}

/** A Camera3D of the world, whether or not the world renders through it. */
interface WorldCamera extends CameraResources {
  path: string;
  current: boolean;
}

const cameras = createWorldPublications<WorldCamera>();

/** Puts a Camera3D and what it holds in its world, whether or not the world renders through it. */
export function usePublishCamera(path: string, current: boolean, held: CameraResources): void {
  const { attributes, environment } = held;
  cameras.usePublish(
    useMemo(() => ({ path, current, attributes, environment }), [path, current, attributes, environment])
  );
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
  if (world === 'subViewport') return electViewportCamera(worldCameras, (camera) => camera.current);
  return worldCameras.find((camera) => camera.path === viewedPath) ?? null;
}

/** The attributes of a resolution, or null while there are none to read. */
function attributesOf(resolution: CameraAttributesResolution | null): CameraAttributes | null {
  return resolution?.status === 'resolved' ? resolution.attributes : null;
}

/**
 * The CameraAttributes the world renders with, null when there are no valid ones, and Godot's frame
 * is not scaled at all. The factor and the auto exposure are read from the one record.
 */
const CameraAttributesContext = createContext<CameraAttributes | null>(null);

/** Chooses the world's CameraAttributes and gives its readers the exposure. One per world. */
export function WorldExposureScope({ children }: { children: ReactNode }) {
  return (
    <cameraAttributes.Provider>
      <cameras.Provider>
        <RenderCameraProvider>{children}</RenderCameraProvider>
      </cameras.Provider>
    </cameraAttributes.Provider>
  );
}

/** Gathers a world's CameraAttributes for the viewports that draw it, with no camera of its own. */
export function WorldCameraAttributesScope({ children }: { children: ReactNode }) {
  return <cameraAttributes.Provider>{children}</cameraAttributes.Provider>;
}

/**
 * Gives the readers below the exposure of the world's own CameraAttributes, for a world that no one
 * camera renders. It reads the chooser of the enclosing `WorldCameraAttributesScope`.
 */
export function WorldAttributesExposure({ children }: { children: ReactNode }) {
  const attributes = attributesOf(cameraAttributes.useChosen());
  return <CameraAttributesContext.Provider value={attributes}>{children}</CameraAttributesContext.Provider>;
}

/**
 * Chooses the camera of a viewport that shares its parent's world. The world's CameraAttributes
 * group is the parent's, keyed by its scenario (`world_environment.cpp:87-93`), so a node inside
 * publishes to the parent's chooser.
 */
export function SharedWorldExposureScope({ children }: { children: ReactNode }) {
  return (
    <cameras.Provider>
      <RenderCameraProvider>{children}</RenderCameraProvider>
    </cameras.Provider>
  );
}

/** The Environment of the camera the world renders through, null for none. */
const RenderCameraEnvironmentContext = createContext<EnvironmentResolution | null>(null);

/**
 * The Environment of the camera the viewport renders through, which replaces its world's once it
 * resolves (`renderer_scene_cull.cpp:3594-3597`). Null when it renders through none.
 */
export function useRenderCameraEnvironment(): EnvironmentResolution | null {
  return useContext(RenderCameraEnvironmentContext);
}

function RenderCameraProvider({ children }: { children: ReactNode }) {
  const world = useWorldKind();
  const viewedPath = useOptionalViewportActions()?.activeCameraPath ?? null;
  const renderCamera = renderCameraOf(world, viewedPath, cameras.useAll());
  const worldAttributes = cameraAttributes.useChosen();
  // A camera's resolved attributes replace the world's: Godot forces them over the scenario's
  // (`renderer_scene_cull.cpp:3562-3565`). While a camera's `.tres` loads, the world's hold, since
  // Godot has no load gap to show.
  const chosen = renderCamera?.attributes.status === 'resolved' ? renderCamera.attributes : worldAttributes;
  const attributes = attributesOf(chosen);
  useSceneExposure(
    attributes?.exposureMultiplier ?? null,
    attributesOf(worldAttributes)?.exposureMultiplier ?? null
  );
  return (
    <RenderCameraEnvironmentContext.Provider value={renderCamera?.environment ?? null}>
      <CameraAttributesContext.Provider value={attributes}>{children}</CameraAttributesContext.Provider>
    </RenderCameraEnvironmentContext.Provider>
  );
}

/**
 * The world's exposure factor, or null without CameraAttributes. A lightmap needs the
 * difference: with no attributes it reads 1, not the factor over its baked exposure
 * (`render_forward_clustered.cpp:1222-1229`).
 *
 * @canonical The exposure factor of a world
 */
export function useOptionalExposureFactor(): number | null {
  return useContext(CameraAttributesContext)?.exposureMultiplier ?? null;
}

/**
 * The factor a consumer scales by: 1 without CameraAttributes.
 *
 * @canonical The exposure factor of a world
 */
export function useExposureFactor(): number {
  return useOptionalExposureFactor() ?? 1;
}

/**
 * The auto exposure of the attributes the world renders with, or null without one. The root
 * world's compositor reduces the frame's luminance for it.
 */
export function useAutoExposure(): AutoExposure | null {
  return useContext(CameraAttributesContext)?.autoExposure ?? null;
}
