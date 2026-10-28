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
import { WorldExposureScope } from './worldExposure';
import { createWorldGroup, type WorldResolution } from './worldGroup';
import { SharedWorldToneMapProvider, WorldToneMapProvider } from './worldToneMap';
import { previewEnvironment } from '../preview/godotPreviewLighting';
import { NO_RESOURCES } from '../SceneResourcesContext';

/** What a WorldEnvironment's `environment` resolves to, when it holds a valid one. */
export type EnvironmentResolution = WorldResolution<{ environment: EnvironmentLayerProps }>;

const environments = createWorldGroup<{ environment: EnvironmentLayerProps }>();

export const usePublishEnvironment = environments.usePublish;

/**
 * One viewport's world: the WorldEnvironments inside publish to it, and its choosers apply the
 * winners. The Environment and the CameraAttributes choose apart. A sub-viewport that
 * `sharesParentWorld` tonemaps with the parent's Environment when it has none of its own.
 */
export function WorldEnvironmentScope({
  world,
  sharesParentWorld = false,
  children,
}: {
  world: WorldKind;
  sharesParentWorld?: boolean;
  children: ReactNode;
}) {
  return (
    <WorldKindProvider world={world}>
      <environments.Provider>
        <WorldExposureScope>
          {world === 'root' ? (
            <RootEnvironment>{children}</RootEnvironment>
          ) : (
            <SubViewportEnvironment sharesParentWorld={sharesParentWorld}>{children}</SubViewportEnvironment>
          )}
        </WorldExposureScope>
      </environments.Provider>
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
  const applied = showsPreview ? previewEnvironment().settings : resolvedSettings(authored);
  const resources = authored?.status === 'resolved' ? authored.environment.resources : NO_RESOURCES;
  return (
    <WorldToneMapProvider settings={applied} resources={resources}>
      <RootEnvironmentLayer authored={authored} showsPreview={showsPreview} />
      {children}
      {preview.sun && <PreviewSun />}
    </WorldToneMapProvider>
  );
}

/** The settings of a resolved Environment, else null. */
function resolvedSettings(authored: EnvironmentResolution | null) {
  return authored?.status === 'resolved' ? authored.environment.settings : null;
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
function SubViewportEnvironment({
  sharesParentWorld,
  children,
}: {
  sharesParentWorld: boolean;
  children: ReactNode;
}) {
  const authored = environments.useChosen();
  const resolved = authored?.status === 'resolved' ? authored.environment : null;
  const ToneMapProvider = sharesParentWorld ? SharedWorldToneMapProvider : WorldToneMapProvider;
  // One tree shape in either state, so a resolve never remounts the portal.
  return (
    <ToneMapProvider settings={resolved?.settings ?? null} resources={resolved?.resources ?? NO_RESOURCES}>
      {resolved && <EnvironmentLayer {...resolved} />}
      {children}
    </ToneMapProvider>
  );
}
