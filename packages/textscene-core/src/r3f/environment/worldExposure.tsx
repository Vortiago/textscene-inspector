import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { AutoExposure, CameraAttributes } from '../../resources/cameraattributes/types';
import { useEnclosingViewportPath } from '../contexts/EnclosingViewportContext';
import { useOptionalViewportActions } from '../contexts/ViewportActionsContext';
import { useSceneExposure } from '../exposure/sceneExposure';
import { useByValue } from '../hooks/useByValue';
import { sameElements } from '../../utils/sameElements';
import { useCurrentCamera3D, useCurrentCameras3D } from '../currentCamera';
import { useRegisterSceneCameraResources, useSceneCameraResources } from '../sceneCameras';
import { useViewportDescription } from '../viewportRender/viewportDescriptionContext';
import type { ViewportDescription } from '../viewportRender/viewportDescription';
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
  /** The nearest viewport above the camera, null for the root viewport. */
  viewport: string | null;
}

const cameras = createWorldPublications<WorldCamera>();

/** Puts a Camera3D and what it holds in its world, whether or not the world renders through it. */
export function usePublishCamera(path: string, held: CameraResources): void {
  const { attributes, environment } = held;
  useRegisterSceneCameraResources(
    path,
    useMemo(() => ({ attributes, environment }), [attributes, environment])
  );
  const viewport = useEnclosingViewportPath();
  cameras.usePublish(
    useMemo(() => ({ path, viewport, attributes, environment }), [path, viewport, attributes, environment])
  );
}

/** The published camera at `path`, null for none. */
function cameraAt(worldCameras: readonly WorldCamera[], path: string | null): WorldCamera | null {
  return path === null ? null : (worldCameras.find((camera) => camera.path === path) ?? null);
}

/** The editor renders through the previewed camera or none, since its own holds no attributes. */
function renderCameraOf(
  rule: ViewportDescription['camera'],
  viewedPath: string | null,
  previewed: CameraResources | null,
  currentPath: string | null,
  worldCameras: readonly WorldCamera[]
): CameraResources | null {
  if (rule === 'current') return cameraAt(worldCameras, currentPath);
  return previewed ?? cameraAt(worldCameras, viewedPath);
}

/** The attributes of a resolution, or null while there are none to read. */
function attributesOf(resolution: CameraAttributesResolution | null): CameraAttributes | null {
  return resolution?.status === 'resolved' ? resolution.attributes : null;
}

/**
 * The attributes a render through `camera` draws with: the camera's once they resolve, else the
 * world's. Godot forces a camera's over the scenario's (`renderer_scene_cull.cpp:3562-3565`). While a
 * camera's `.tres` loads, the world's hold, since Godot has no load gap to show.
 */
function drawnAttributes(
  camera: CameraResources | null,
  worldAttributes: CameraAttributesResolution | null
): CameraAttributes | null {
  return attributesOf(camera?.attributes.status === 'resolved' ? camera.attributes : worldAttributes);
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

/** The CameraAttributes and cameras of a world only its shared viewports draw, as a canvas World3D. */
export function WorldCamerasScope({ children }: { children: ReactNode }) {
  return (
    <cameraAttributes.Provider>
      <cameras.Provider>{children}</cameras.Provider>
    </cameraAttributes.Provider>
  );
}

/**
 * Gives the readers below the exposure of the world's own CameraAttributes, for a world that no one
 * camera renders. It reads the chooser of the enclosing `WorldCamerasScope`.
 */
export function WorldAttributesExposure({ children }: { children: ReactNode }) {
  const attributes = attributesOf(cameraAttributes.useChosen());
  return <CameraAttributesContext.Provider value={attributes}>{children}</CameraAttributesContext.Provider>;
}

/**
 * The exposure of a viewport that shares its parent's world. The world's CameraAttributes group and
 * its cameras are the parent's, keyed by its scenario (`world_environment.cpp:87-93`), so a node
 * inside publishes to the parent's. The scene holds the world's exposure for every viewport that
 * draws it, and each pass draws at its own (`ViewportPassAttributes`).
 */
export function SharedWorldExposureScope({ children }: { children: ReactNode }) {
  const factor = attributesOf(cameraAttributes.useChosen())?.exposureMultiplier ?? null;
  useSceneExposure(factor, factor);
  return <WorldAttributesExposure>{children}</WorldAttributesExposure>;
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
  const rule = useViewportDescription().camera;
  const viewedPath = useOptionalViewportActions()?.previewedCameraPath ?? null;
  const renderCamera = renderCameraOf(
    rule,
    viewedPath,
    useSceneCameraResources(viewedPath),
    useCurrentCamera3D(useEnclosingViewportPath()),
    cameras.useAll()
  );
  const worldAttributes = cameraAttributes.useChosen();
  const attributes = drawnAttributes(renderCamera, worldAttributes);
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

/** The camera the pass of the viewport above draws through, null for none. */
const PassCameraContext = createContext<WorldCamera | null>(null);

/**
 * Gives the tonemap stage at `path` the attributes of the viewport's current camera, else the world's.
 *
 * @canonical The attributes a viewport pass draws with
 */
export function ViewportPassAttributes({ path, children }: { path: string; children: ReactNode }) {
  const worldCameras = cameras.useAll();
  const worldAttributes = cameraAttributes.useChosen();
  const currentPath = useCurrentCamera3D(path);
  const camera = useMemo(() => cameraAt(worldCameras, currentPath), [worldCameras, currentPath]);
  const attributes = drawnAttributes(camera, worldAttributes);
  return (
    <PassCameraContext.Provider value={camera}>
      <CameraAttributesContext.Provider value={attributes}>{children}</CameraAttributesContext.Provider>
    </PassCameraContext.Provider>
  );
}

/** The path of the camera the enclosing `ViewportPassAttributes` draws through, null for none. */
export function usePassCameraPath(): string | null {
  return useContext(PassCameraContext)?.path ?? null;
}

/** The Environment of the current camera of each viewport pass of the world, apart from the root's. */
export function usePassCameraEnvironments(): readonly EnvironmentResolution[] {
  const worldCameras = cameras.useAll();
  const viewports = useByValue(
    [...new Set(worldCameras.map((camera) => camera.viewport).filter((path) => path !== null))],
    sameElements
  );
  const currentPaths = useCurrentCameras3D(viewports);
  const current = useMemo(
    () =>
      currentPaths
        .map((path) => cameraAt(worldCameras, path)?.environment)
        .filter((environment) => environment !== undefined),
    [currentPaths, worldCameras]
  );
  // A camera that publishes again mostly leaves the same Environments current.
  return useByValue(current, sameElements);
}

/** The Environment of the camera the enclosing `ViewportPassAttributes` draws through, null for none. */
export function usePassCameraEnvironment(): EnvironmentResolution | null {
  return useContext(PassCameraContext)?.environment ?? null;
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
