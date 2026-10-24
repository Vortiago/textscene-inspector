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
import { createWorldGroup } from './worldGroup';

/**
 * What a WorldEnvironment's `environment` resolves to. `none` is no reference, a `.tres` that
 * failed to load or a resource of another type: Godot holds no valid Environment for any of them.
 */
export type EnvironmentResolution =
  { status: 'pending' } | { status: 'none' } | { status: 'resolved'; environment: EnvironmentLayerProps };

/** The one `pending` and `none` value, so an unchanged resolution publishes nothing. */
export const PENDING_ENVIRONMENT: EnvironmentResolution = { status: 'pending' };
export const NO_ENVIRONMENT: EnvironmentResolution = { status: 'none' };

const environments = createWorldGroup<EnvironmentResolution>(NO_ENVIRONMENT);

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
            <>
              <SubViewportEnvironment />
              {children}
            </>
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
  return (
    <>
      <RootEnvironmentLayer authored={authored} showsPreview={preview.environment} />
      {children}
      {preview.sun && <PreviewSun />}
    </>
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
  // A publication proves a WorldEnvironment node, which takes the preview away by type.
  return !authored && showsPreview ? <PreviewEnvironment /> : <NoEnvironmentLayer />;
}

/**
 * A sub-viewport's portal world. Its pass sets its own clear colour, so only a resolved Environment
 * adds a layer here, and a missing one leaves the root's clear colour alone.
 */
function SubViewportEnvironment() {
  const authored = environments.useChosen();
  return authored?.status === 'resolved' ? <EnvironmentLayer {...authored.environment} /> : null;
}
