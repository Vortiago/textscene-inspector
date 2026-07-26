/**
 * Resolve `WorldEnvironment.environment` → `Environment.sky` → `Sky.sky_material`,
 * accepting either form at every level.
 *
 * Godot treats `SubResource("id")` and `ExtResource("id")` identically here; following
 * only the inline form means a scene keeping any of the three in a standalone `.tres`
 * silently gets no environment or no sky. Losing the sky costs more than a backdrop: an
 * Environment can draw its ambient from the sky, so surfaces the sun does not reach go
 * black.
 *
 * A hook rather than a pure function because the external form loads through the
 * resource pipeline. `useSubOrExtResource` returns the inline case synchronously on the
 * first render, so the overwhelmingly common all-inline scene resolves in one pass with
 * no flash. The levels are independent: a resolved Environment applies its fog and
 * tonemapping immediately even while its sky `.tres` is still in flight
 * (**Progressive fill-in**).
 */

import { useMemo } from 'react';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useSubOrExtResource } from '../../../resources/useSubOrExtResource';
import { parseEnvironment } from '../../../resources/environment/parser';
import { createEnvironmentSettings } from '../../../resources/environment/renderer';
import type { EnvironmentSettings } from '../../../resources/environment/renderer';
import { parseSkyMaterial } from '../../../resources/sky/parser';
import type { SkyProperties } from '../../../resources/sky/types';

export interface ResolvedEnvironment {
  settings: EnvironmentSettings;
  /** Null while a sky `.tres` is loading, and for an environment with no sky. */
  sky: SkyProperties | null;
}

export function useResolvedEnvironment(
  environmentRef: string | undefined
): ResolvedEnvironment | null {
  const { internalResources, externalResources } = useSceneResources();

  const environment = useSubOrExtResource(environmentRef, internalResources, externalResources);
  const envProps = useMemo(
    () =>
      environment?.type === 'Environment'
        ? parseEnvironment(environment.data as Record<string, string>)
        : null,
    [environment]
  );

  // Hooks run unconditionally with `undefined` when the level above did not resolve;
  // `useSubOrExtResource` short-circuits that to "nothing", so rules of hooks holds
  // whatever shape the chain takes.
  const skyResource = useSubOrExtResource(envProps?.sky, internalResources, externalResources);
  const materialRef =
    skyResource?.type === 'Sky'
      ? (skyResource.data as { sky_material?: string }).sky_material
      : undefined;
  const material = useSubOrExtResource(materialRef, internalResources, externalResources);

  const sky = useMemo(
    () => (material ? parseSkyMaterial(material.type, material.data as Record<string, string>) : null),
    [material]
  );

  return useMemo(
    () => (envProps ? { settings: createEnvironmentSettings(envProps), sky } : null),
    [envProps, sky]
  );
}
