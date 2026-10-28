/**
 * The Environment each world draws with. Godot's World3D takes the Environment of the first
 * WorldEnvironment in its group, which only a node with a valid Environment joins
 * (`world_environment.cpp:40-41`, `:77-83`). One chooser per world applies it (ADR-0025). The
 * CameraAttributes choose apart (`worldExposure.tsx`).
 */

import type { ReactNode } from 'react';
import { EnvironmentLayer, type EnvironmentLayerProps } from './EnvironmentLayer';
import { NoEnvironmentLayer } from './NoEnvironmentLayer';
import { PreviewEnvironment } from '../preview/PreviewEnvironment';
import { PreviewSun } from '../preview/PreviewSun';
import { usePreviewYield } from '../preview/usePreviewYield';
import { WorldKindProvider, type WorldKind } from './WorldKindContext';
import { SharedWorldExposureScope, WorldCameraAttributesScope, WorldExposureScope } from './worldExposure';
import { createWorldGroup, type WorldResolution } from './worldGroup';
import { WorldToneMapProvider } from './worldToneMap';
import { previewEnvironment } from '../preview/godotPreviewLighting';
import { NO_RESOURCES } from '../SceneResourcesContext';

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
 * (`renderer_viewport.cpp:362`), and only its shared viewports draw it, with its Environment.
 */
export function CanvasWorldScope({ children }: { children: ReactNode }) {
  return (
    <environments.Provider>
      <WorldCameraAttributesScope>
        <CanvasWorldEnvironment>{children}</CanvasWorldEnvironment>
      </WorldCameraAttributesScope>
    </environments.Provider>
  );
}

function CanvasWorldEnvironment({ children }: { children: ReactNode }) {
  const resolved = resolvedEnvironment(environments.useChosen());
  return (
    <WorldToneMapProvider
      settings={resolved?.settings ?? null}
      resources={resolved?.resources ?? NO_RESOURCES}
    >
      {children}
    </WorldToneMapProvider>
  );
}

/**
 * A sub-viewport's portal into its parent's world. Godot keys a world's WorldEnvironment group by
 * its scenario (`world_environment.cpp:76-85`), so a node inside publishes to the parent's chooser,
 * whose first node in tree order wins for both, and the portal draws with the parent's choice.
 */
export function SharedWorldEnvironmentScope({ children }: { children: ReactNode }) {
  return (
    <WorldKindProvider world="subViewport">
      <SharedWorldExposureScope>
        <SharedWorldEnvironment>{children}</SharedWorldEnvironment>
      </SharedWorldExposureScope>
    </WorldKindProvider>
  );
}

/**
 * The root viewport's Environment, which falls back to the editor preview environment, and the
 * editor preview sun after the scene, so the scene's own nodes come first. One yield serves both,
 * since each walks the whole live tree.
 */
function RootEnvironment({ children }: { children: ReactNode }) {
  const authored = environments.useChosen();
  const preview = usePreviewYield();
  // A publication proves a WorldEnvironment node, which takes the preview away by type.
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
  const resolved = resolvedEnvironment(environments.useChosen());
  // One tree shape in either state, so a resolve never remounts the portal.
  return (
    <WorldToneMapProvider
      settings={resolved?.settings ?? null}
      resources={resolved?.resources ?? NO_RESOURCES}
    >
      {resolved && <EnvironmentLayer {...resolved} />}
      {children}
    </WorldToneMapProvider>
  );
}

/** The parent world's Environment drawn into the portal. Its tonemap is the parent's already. */
function SharedWorldEnvironment({ children }: { children: ReactNode }) {
  const resolved = resolvedEnvironment(environments.useChosen());
  return (
    <>
      {resolved && <EnvironmentLayer {...resolved} />}
      {children}
    </>
  );
}

function resolvedEnvironment(authored: EnvironmentResolution | null): EnvironmentLayerProps | null {
  return authored?.status === 'resolved' ? authored.environment : null;
}
