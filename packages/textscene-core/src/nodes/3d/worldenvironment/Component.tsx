/**
 * <WorldEnvironment> applies the scene's Environment: background, sky, ambient, tonemapping, fog,
 * glow and the colour adjustments, but not SSR. `useResolvedEnvironment` follows the reference
 * chain. The application lives in `<EnvironmentLayer>`, shared with the editor preview environment
 * (ADR-0025) so the two cannot drift. A WorldEnvironment that names no Environment leaves the root
 * with none. The node draws no geometry, and its children still render.
 */

import type { WorldEnvironmentProperties } from './types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { EnvironmentLayer } from '../../../r3f/environment/EnvironmentLayer';
import { NoEnvironmentLayer } from '../../../r3f/environment/NoEnvironmentLayer';
import { useResolvedEnvironment } from './useResolvedEnvironment';

export function WorldEnvironment({ node, children }: NodeComponentProps) {
  const properties = node.properties as WorldEnvironmentProperties;
  const resolved = useResolvedEnvironment(properties.environment);

  return (
    <group name={node.name}>
      {resolved && (
        <EnvironmentLayer
          settings={resolved.settings}
          sky={resolved.sky}
          resources={resolved.resources}
          skyResources={resolved.skyResources}
        />
      )}
      {/* Only an unnamed Environment: a named one resolves to null while its `.tres` loads. */}
      {!properties.environment && <NoEnvironmentLayer />}
      {children}
    </group>
  );
}
