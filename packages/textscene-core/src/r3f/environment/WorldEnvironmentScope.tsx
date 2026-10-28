/**
 * The Environment each world draws with. Godot's World3D takes the Environment of the first
 * WorldEnvironment in its group, which only a node with a valid Environment joins
 * (`world_environment.cpp:40-41`, `:77-83`). One chooser per world applies it (ADR-0025). The
 * CameraAttributes choose apart (`worldExposure.tsx`).
 */

import { useMemo, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { createPortal } from '@react-three/fiber';
import { EnvironmentLayer, type EnvironmentLayerProps } from './EnvironmentLayer';
import { NoEnvironmentLayer } from './NoEnvironmentLayer';
import { PreviewEnvironment } from '../preview/PreviewEnvironment';
import { PreviewSun } from '../preview/PreviewSun';
import { usePreviewYield } from '../preview/usePreviewYield';
import { WorldKindProvider, type WorldKind } from './WorldKindContext';
import {
  SharedWorldExposureScope,
  WorldCameraAttributesScope,
  WorldExposureScope,
  useRenderCameraEnvironment,
} from './worldExposure';
import { createWorldGroup, type WorldResolution } from './worldGroup';
import { WorldToneMapProvider } from './worldToneMap';
import { previewEnvironment } from '../preview/godotPreviewLighting';
import { NO_RESOURCES } from '../SceneResourcesContext';
import { CanvasWorkspaceProvider } from '../contexts/CanvasWorkspaceContext';
import { useSceneShadowFit } from '../SceneShadowFitter';
import { useSceneDepthPrepass } from '../depthPrepass/SceneDepthPrepass';
import { CanvasWorldContext, type CanvasWorld } from './canvasWorldScene';

/** What a WorldEnvironment's `environment` resolves to, when it holds a valid one. */
export type EnvironmentResolution = WorldResolution<{ environment: EnvironmentLayerProps }>;

const environments = createWorldGroup<{ environment: EnvironmentLayerProps }>();

export const usePublishEnvironment = environments.usePublish;

/**
 * One viewport's world: the WorldEnvironments inside publish to it, and its choosers apply the
 * winners. The Environment and the CameraAttributes choose apart.
 */
export function WorldEnvironmentScope({ world, children }: { world: WorldKind; children: ReactNode }) {
  return (
    <WorldKindProvider world={world}>
      <environments.Provider>
        <WorldExposureScope>
          {world === 'root' ? (
            <RootEnvironment>{children}</RootEnvironment>
          ) : (
            <SubViewportEnvironment>{children}</SubViewportEnvironment>
          )}
        </WorldExposureScope>
      </environments.Provider>
    </WorldKindProvider>
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
  useSceneShadowFit(drawnScene);
  useSceneDepthPrepass(drawnScene);
  return (
    <environments.Provider>
      <WorldCameraAttributesScope>
        <CanvasWorldContext.Provider value={world}>
          <CanvasWorldEnvironment scene={drawnScene}>{children}</CanvasWorldEnvironment>
        </CanvasWorldContext.Provider>
      </WorldCameraAttributesScope>
    </environments.Provider>
  );
}

/** The canvas world's Environment, drawn into its scene only while that scene is drawn. */
function CanvasWorldEnvironment({ scene, children }: { scene: THREE.Scene | null; children: ReactNode }) {
  const resolved = resolvedEnvironment(environments.useChosen());
  // The layer draws into the world's scene as a 3D view does, whatever the canvas draws.
  const layer =
    scene &&
    createPortal(
      <CanvasWorkspaceProvider workspace="3d">
        <WorldKindProvider world="subViewport">
          {resolved && <EnvironmentLayer {...resolved} />}
        </WorldKindProvider>
      </CanvasWorkspaceProvider>,
      scene
    );
  return (
    <EnvironmentToneMap environment={resolved}>
      {layer}
      {children}
    </EnvironmentToneMap>
  );
}

/**
 * A sub-viewport's portal into its parent's world, which only a 2D canvas portals. Godot keys a
 * world's WorldEnvironment group by its scenario (`world_environment.cpp:76-85`), so a node inside
 * publishes to the parent's chooser, whose first node in tree order wins for both. The canvas's
 * world draws that Environment into the shared scene, so the portal adds only its tonemap.
 */
export function SharedWorldEnvironmentScope({ children }: { children: ReactNode }) {
  return (
    <WorldKindProvider world="subViewport">
      <SharedWorldExposureScope>
        <SharedWorldToneMap>{children}</SharedWorldToneMap>
      </SharedWorldExposureScope>
    </WorldKindProvider>
  );
}

function SharedWorldToneMap({ children }: { children: ReactNode }) {
  return (
    <EnvironmentToneMap environment={resolvedEnvironment(useViewEnvironment())}>
      {children}
    </EnvironmentToneMap>
  );
}

/**
 * The root viewport's Environment, which falls back to the editor preview environment, and the
 * editor preview sun after the scene, so the scene's own nodes come first. One yield serves both,
 * since each walks the whole live tree.
 */
function RootEnvironment({ children }: { children: ReactNode }) {
  const authored = useViewEnvironment();
  const preview = usePreviewYield();
  // An authored Environment proves a WorldEnvironment node or a camera's, and takes the preview away.
  const showsPreview = !authored && preview.environment;
  const resolved = resolvedEnvironment(authored);
  const applied = showsPreview ? previewEnvironment().settings : (resolved?.settings ?? null);
  const resources = resolved?.resources ?? NO_RESOURCES;
  return (
    <WorldToneMapProvider settings={applied} resources={resources}>
      <RootEnvironmentLayer authored={authored} showsPreview={showsPreview} />
      {children}
      {preview.sun && <PreviewSun />}
    </WorldToneMapProvider>
  );
}

function RootEnvironmentLayer({
  authored,
  showsPreview,
}: {
  authored: EnvironmentResolution | null;
  showsPreview: boolean;
}) {
  if (authored?.status === 'resolved') return <EnvironmentLayer {...authored.environment} />;
  if (authored?.status === 'pending') return null;
  return showsPreview ? <PreviewEnvironment /> : <NoEnvironmentLayer />;
}

/**
 * A sub-viewport's portal world. Its pass sets its own clear colour, so only a resolved Environment
 * adds a layer here, and a missing one leaves the root's clear colour alone.
 */
function SubViewportEnvironment({ children }: { children: ReactNode }) {
  const resolved = resolvedEnvironment(useViewEnvironment());
  // One tree shape in either state, so a resolve never remounts the portal.
  return (
    <EnvironmentToneMap environment={resolved}>
      {resolved && <EnvironmentLayer {...resolved} />}
      {children}
    </EnvironmentToneMap>
  );
}

/** Tonemaps the world below with `environment`, or with Godot's defaults where it is null. */
function EnvironmentToneMap({
  environment,
  children,
}: {
  environment: EnvironmentLayerProps | null;
  children: ReactNode;
}) {
  return (
    <WorldToneMapProvider
      settings={environment?.settings ?? null}
      resources={environment?.resources ?? NO_RESOURCES}
    >
      {children}
    </WorldToneMapProvider>
  );
}

/**
 * The Environment a viewport renders with. A camera's resolved one replaces the world's
 * (`renderer_scene_cull.cpp:3594-3597`). While it loads the world's holds, since Godot has no load
 * gap to show.
 */
function useViewEnvironment(): EnvironmentResolution | null {
  const camera = useRenderCameraEnvironment();
  const world = environments.useChosen();
  return camera?.status === 'resolved' ? camera : world;
}

function resolvedEnvironment(authored: EnvironmentResolution | null): EnvironmentLayerProps | null {
  return authored?.status === 'resolved' ? authored.environment : null;
}
