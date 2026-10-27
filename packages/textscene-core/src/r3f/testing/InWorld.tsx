/**
 * Puts a component under test in the world a Camera3D publishes to, without the preview
 * environment of a full `WorldEnvironmentScope`. Test-only: the `testing/` directories under `src`
 * are excluded from the build.
 */
import type { ReactNode } from 'react';
import { WorldKindProvider, type WorldKind } from '../environment/WorldKindContext';
import { WorldExposureScope } from '../environment/worldExposure';

/** The root world unless `world` says otherwise. */
export function InWorld({ world = 'root', children }: { world?: WorldKind; children: ReactNode }) {
  return (
    <WorldKindProvider world={world}>
      <WorldExposureScope>{children}</WorldExposureScope>
    </WorldKindProvider>
  );
}
