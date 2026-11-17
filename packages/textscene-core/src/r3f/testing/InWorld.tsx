/**
 * Puts a component under test in the world a Camera3D publishes to, without the preview
 * environment of a full `WorldEnvironmentScope`. Test-only: the `testing/` directories under `src`
 * are excluded from the build.
 */
import type { ReactNode } from 'react';
import { WorldExposureScope } from '../environment/worldExposure';

export function InWorld({ children }: { children: ReactNode }) {
  return <WorldExposureScope>{children}</WorldExposureScope>;
}
