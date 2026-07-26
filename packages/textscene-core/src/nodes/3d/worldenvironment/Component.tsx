/**
 * <WorldEnvironment> — applies the scene's own Environment: background, sky,
 * ambient, tonemapping and fog. Post-processing (adjustments, SSR, glow) is not
 * reproduced.
 *
 * The reference chain — environment → sky → sky material — is followed by
 * `useResolvedEnvironment`, which accepts either the inline or the external `.tres`
 * form at every level.
 *
 * The application itself lives in `<EnvironmentLayer>`, shared with the editor
 * preview environment (ADR-0025) so the two cannot drift.
 *
 * WorldEnvironment does not render visible geometry, but children are still
 * rendered so the node remains part of the scene tree.
 */

import type { WorldEnvironmentProperties } from './types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { EnvironmentLayer } from '../../../r3f/environment/EnvironmentLayer';
import { useResolvedEnvironment } from './useResolvedEnvironment';

export function WorldEnvironment({ node, children }: NodeComponentProps) {
  const properties = node.properties as WorldEnvironmentProperties;
  const resolved = useResolvedEnvironment(properties.environment);

  return (
    <group name={node.name}>
      {resolved && <EnvironmentLayer settings={resolved.settings} sky={resolved.sky} />}
      {children}
    </group>
  );
}
