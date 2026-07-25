/**
 * <WorldEnvironment> — applies the scene's own Environment: background, sky,
 * ambient, tonemapping and fog. Resolves the Environment SubResource
 * synchronously from SceneResourcesContext; post-processing (adjustments, SSR,
 * glow) is not reproduced.
 *
 * The application itself lives in `<EnvironmentLayer>`, shared with the editor
 * preview environment (ADR-0025) so the two cannot drift.
 *
 * WorldEnvironment does not render visible geometry, but children are still
 * rendered so the node remains part of the scene tree.
 */

import { useMemo } from 'react';
import type { WorldEnvironmentProperties } from './types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { findSubResource, useSceneResources } from '../../../r3f/SceneResourcesContext';
import { parseResourceReference } from '../../../resources/SubResourceResolver';
import { parseEnvironment } from '../../../resources/environment/parser';
import { createEnvironmentSettings } from '../../../resources/environment/renderer';
import type { EnvironmentSettings } from '../../../resources/environment/renderer';
import { resolveSky } from '../../../resources/sky/parser';
import type { SkyProperties } from '../../../resources/sky/types';
import { EnvironmentLayer } from '../../../r3f/environment/EnvironmentLayer';

export function WorldEnvironment({ node, children }: NodeComponentProps) {
  const properties = node.properties as WorldEnvironmentProperties;
  const { internalResources } = useSceneResources();

  const resolved = useMemo(
    () => resolveEnvironment(properties.environment, internalResources),
    [properties.environment, internalResources]
  );

  return (
    <group name={node.name}>
      {resolved && <EnvironmentLayer settings={resolved.settings} sky={resolved.sky} />}
      {children}
    </group>
  );
}

function resolveEnvironment(
  environmentRef: string | undefined,
  internalResources: ReturnType<typeof useSceneResources>['internalResources']
): { settings: EnvironmentSettings; sky: SkyProperties | null } | null {
  if (!environmentRef) return null;
  const parsed = parseResourceReference(environmentRef);
  if (!parsed || parsed.type !== 'SubResource') return null;
  const resource = findSubResource(internalResources, parsed.id);
  if (!resource || resource.type !== 'Environment') return null;
  const envProps = parseEnvironment(resource.data as Record<string, string>);
  return {
    settings: createEnvironmentSettings(envProps),
    sky: resolveSky(envProps.sky, internalResources),
  };
}
