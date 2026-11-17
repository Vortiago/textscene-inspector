/**
 * The Environment each world draws with. Godot's World3D takes the Environment of the first
 * WorldEnvironment in its group, which only a node with a valid Environment joins
 * (`world_environment.cpp:40-41`, `:77-83`). One chooser per world applies it (ADR-0025). A viewport
 * pass draws with its camera's own (`ViewportPassEnvironment`). The CameraAttributes choose apart
 * (`worldExposure.tsx`).
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { createPortal } from '@react-three/fiber';
import { DrawnEnvironmentLayer, EnvironmentLayer, type EnvironmentLayerProps } from './EnvironmentLayer';
import { NoEnvironmentLayer } from './NoEnvironmentLayer';
import { Compositor } from './Compositor';
import { useDraws3D } from './draws3D';
import { previewEnvironment } from '../preview/godotPreviewLighting';
import { PreviewSun } from '../preview/PreviewSun';
import { usePreviewYield } from '../preview/usePreviewYield';
import {
  SharedWorldExposureScope,
  WorldAttributesExposure,
  WorldCamerasScope,
  WorldExposureScope,
  usePassCameraEnvironment,
  usePassCameraEnvironments,
  useRenderCameraEnvironment,
} from './worldExposure';
import { createWorldGroup, type WorldResolution } from './worldGroup';
import { PassToneMapProvider } from './passToneMap';
import { CanvasWorkspaceProvider } from '../contexts/CanvasWorkspaceContext';
import { useSceneShadowFit } from '../SceneShadowFitter';
import { useRootViewportDescription } from '../viewportRender/useRootViewportDescription.js';
import { useSceneDepthPrepass } from '../depthPrepass/SceneDepthPrepass';
import { CanvasWorldContext, type CanvasWorld } from './canvasWorldScene';
import { identityKey } from '../../utils/identityKey';
import { useOwnEnvironment } from './sceneEnvironment';
import { useFallbackEnvironment } from './fallbackEnvironment';

/** A resolved Environment: what its layer draws, and the glow map its tonemap pass scales by. */
export interface ResolvedEnvironment extends EnvironmentLayerProps {
  /** The texture `glow_map` names, resolved by the node that holds the Environment. */
  glowMap: THREE.Texture | null;
}

/** What a WorldEnvironment's `environment` resolves to, when it holds a valid one. */
export type EnvironmentResolution = WorldResolution<{ environment: ResolvedEnvironment }>;

/** Which viewport's world a scope holds: the root's or a SubViewport's. */
export type WorldKind = 'root' | 'subViewport';

const environments = createWorldGroup<{ environment: ResolvedEnvironment }>();

export const usePublishEnvironment = environments.usePublish;

/** The world's own Environment, which a pass through a camera with none draws. Null for none. */
const WorldOwnEnvironmentContext = createContext<ResolvedEnvironment | null>(null);

/**
 * One viewport's world: the WorldEnvironments inside publish to it, and its choosers apply the
 * winners. The Environment and the CameraAttributes choose apart.
 */
export function WorldEnvironmentScope({ world, children }: { world: WorldKind; children: ReactNode }) {
  return (
    <environments.Provider>
      <WorldExposureScope>
        {world === 'root' ? (
          <RootEnvironment>{children}</RootEnvironment>
        ) : (
          <SubViewportEnvironment>{children}</SubViewportEnvironment>
        )}
      </WorldExposureScope>
    </environments.Provider>
  );
}

/**
 * The world of a 2D canvas. Its viewport has no camera into it, so Godot draws none of it there
 * (`renderer_viewport.cpp:362`). Only its shared viewports draw it: one scene for all of them, with
 * the world's Environment, its shadow fit and its depth prepass applied once while one holds it.
 */
export function CanvasWorldScope({ children }: { children: ReactNode }) {
  const scene = useMemo(() => {
    const created = new THREE.Scene();
    created.name = 'Canvas::world';
    return created;
  }, []);
  const [holders, setHolders] = useState(0);
  const world = useMemo<CanvasWorld>(
    () => ({
      scene,
      hold: () => {
        setHolders((count) => count + 1);
        return () => setHolders((count) => count - 1);
      },
    }),
    [scene]
  );
  const drawnScene = holders > 0 ? scene : null;
  useSceneShadowFit(drawnScene, useRootViewportDescription().positionalShadowAtlas);
  useSceneDepthPrepass(drawnScene);
  return (
    <environments.Provider>
      <WorldCamerasScope>
        <CanvasWorldContext.Provider value={world}>
          <CanvasWorldEnvironment scene={drawnScene}>{children}</CanvasWorldEnvironment>
        </CanvasWorldContext.Provider>
      </WorldCamerasScope>
    </environments.Provider>
  );
}

/** The canvas world's Environment, drawn into its scene only while that scene is drawn. */
function CanvasWorldEnvironment({ scene, children }: { scene: THREE.Scene | null; children: ReactNode }) {
  const own = resolvedEnvironment(useWorldEnvironment());
  // The layer draws into the world's scene as a 3D view does, whatever the canvas draws, at the
  // exposure of the world's own CameraAttributes, since the viewports that draw it share one.
  const layers =
    scene &&
    createPortal(
      <CanvasWorkspaceProvider workspace="3d">
        <WorldAttributesExposure>
          {own && <EnvironmentLayer {...own} />}
          <DrawnEnvironments shown={own} own={own} />
        </WorldAttributesExposure>
      </CanvasWorkspaceProvider>,
      scene
    );
  return (
    <WorldOwnEnvironmentContext.Provider value={own}>
      {layers}
      {children}
    </WorldOwnEnvironmentContext.Provider>
  );
}

/**
 * A sub-viewport's portal into its parent's world, which only a 2D canvas portals. Godot keys a
 * world's WorldEnvironment group by its scenario (`world_environment.cpp:76-85`), so a node inside
 * publishes to the parent's chooser, whose first node in tree order wins for both. The canvas's
 * world draws its Environments into the shared scene.
 */
export function SharedWorldEnvironmentScope({ children }: { children: ReactNode }) {
  return <SharedWorldExposureScope>{children}</SharedWorldExposureScope>;
}

/** One compositor tonemaps every 3D frame with whichever Environment applies (ADR-0061). */
function RootEnvironment({ children }: { children: ReactNode }) {
  const preview = usePreviewYield();
  const world = useRootWorldEnvironment(preview.environment);
  const authored = useViewEnvironment(world);
  const draws3D = useDraws3D();
  const shown = resolvedEnvironment(authored);
  const own = resolvedEnvironment(world);
  return (
    <WorldOwnEnvironmentContext.Provider value={own}>
      <PassToneMapProvider settings={shown?.settings ?? null} glowMap={shown?.glowMap ?? null}>
        {draws3D && <Compositor />}
        <RootEnvironmentLayer authored={authored} />
        <DrawnEnvironments shown={shown} own={own} />
        {children}
        {preview.sun && <PreviewSun />}
      </PassToneMapProvider>
    </WorldOwnEnvironmentContext.Provider>
  );
}

/** The preview stands in while no WorldEnvironment node does, even one with no valid Environment. */
function useRootWorldEnvironment(previewsEnvironment: boolean): EnvironmentResolution | null {
  const chosen = environments.useChosen();
  const fallback = useFallbackEnvironment();
  if (!chosen) return previewsEnvironment ? previewResolution() : fallback;
  return chosen.status === 'none' ? fallback : chosen;
}

/** Written only by `previewResolution`, on the first preview. Never cleared: the preview never changes. */
let builtPreviewResolution: EnvironmentResolution | undefined;

function previewResolution(): EnvironmentResolution {
  return (builtPreviewResolution ??= { status: 'resolved', environment: previewEnvironment() });
}

function RootEnvironmentLayer({ authored }: { authored: EnvironmentResolution | null }) {
  if (authored?.status === 'resolved') return <EnvironmentLayer {...authored.environment} />;
  if (authored?.status === 'pending') return null;
  return <NoEnvironmentLayer />;
}

/** A sub-viewport's portal world: its WorldEnvironment's layer, else the clear colour's. */
function SubViewportEnvironment({ children }: { children: ReactNode }) {
  const world = useWorldEnvironment();
  const shown = resolvedEnvironment(useViewEnvironment(world));
  const own = resolvedEnvironment(world);
  // One tree shape in either state, so a resolve never remounts the portal.
  return (
    <WorldOwnEnvironmentContext.Provider value={own}>
      {shown && <EnvironmentLayer {...shown} />}
      <DrawnEnvironments shown={shown} own={own} />
      {children}
    </WorldOwnEnvironmentContext.Provider>
  );
}

/**
 * Gives the tonemap stage of a viewport pass, below, the Environment the pass draws with. It reads
 * the camera the enclosing `ViewportPassAttributes` elects.
 *
 * @canonical The Environment a viewport pass draws with
 */
export function ViewportPassEnvironment({ children }: { children: ReactNode }) {
  const drawn = passEnvironmentOf(usePassCameraEnvironment(), useContext(WorldOwnEnvironmentContext));
  return (
    <PassToneMapProvider settings={drawn?.settings ?? null} glowMap={drawn?.glowMap ?? null}>
      {children}
    </PassToneMapProvider>
  );
}

/**
 * Whether a camera's Environment replaces its world's: once it resolves
 * (`renderer_scene_cull.cpp:3594-3597`). While it loads the world's holds, since Godot has no load
 * gap to show.
 */
function replacesWorld(
  camera: EnvironmentResolution | null
): camera is Extract<EnvironmentResolution, { status: 'resolved' }> {
  return camera?.status === 'resolved';
}

/** The Environment a pass through `camera` draws its world with, null for none. */
function passEnvironmentOf(
  camera: EnvironmentResolution | null,
  own: ResolvedEnvironment | null
): ResolvedEnvironment | null {
  return replacesWorld(camera) ? camera.environment : own;
}

/**
 * Mounts each Environment a pass or a probe capture of the world draws with that its scene does not
 * show, and names the world's own on the scene (`drawAsWorld`). Each holds the exposure the scene
 * holds, as the shown one does, and a draw puts its own on (`drawWith`).
 */
function DrawnEnvironments({
  shown,
  own,
}: {
  shown: ResolvedEnvironment | null;
  own: ResolvedEnvironment | null;
}) {
  useOwnEnvironment(own?.settings ?? null);
  const cameras = usePassCameraEnvironments();
  const layers = useMemo(() => {
    const unique = new Map<object, ResolvedEnvironment>();
    for (const drawn of [own, ...cameras.map((camera) => passEnvironmentOf(camera, own))]) {
      if (drawn && drawn.settings !== shown?.settings) unique.set(drawn.settings, drawn);
    }
    return [...unique.values()];
  }, [cameras, own, shown]);
  return layers.map((environment) => (
    <DrawnEnvironmentLayer key={identityKey(environment.settings)} {...environment} />
  ));
}

/** The Environment a viewport renders with: its camera's, else `world` (`replacesWorld`). */
function useViewEnvironment(world: EnvironmentResolution | null): EnvironmentResolution | null {
  const camera = useRenderCameraEnvironment();
  return replacesWorld(camera) ? camera : world;
}

/** The first valid WorldEnvironment's, else the fallback (`renderer_scene_cull.cpp:3604-3610`). */
function useWorldEnvironment(): EnvironmentResolution | null {
  const chosen = environments.useChosen();
  const fallback = useFallbackEnvironment();
  // A loading WorldEnvironment holds its place.
  return chosen && chosen.status !== 'none' ? chosen : fallback;
}

function resolvedEnvironment(authored: EnvironmentResolution | null): ResolvedEnvironment | null {
  return authored?.status === 'resolved' ? authored.environment : null;
}
