/**
 * <WorldEnvironment> applies the scene's Environment: background, sky, ambient, tonemapping, fog,
 * glow and the colour adjustments, but not SSR. `useResolvedEnvironment` follows the reference
 * chain. The application lives in `<EnvironmentLayer>`, shared with the editor preview environment
 * (ADR-0025) so the two cannot drift. The node draws no geometry, and its children still render.
 */

import type { WorldEnvironmentProperties } from './types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { EnvironmentLayer } from '../../../r3f/environment/EnvironmentLayer';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { useResolvedEnvironment } from './useResolvedEnvironment';

export function WorldEnvironment({ node, children }: NodeComponentProps) {
  const properties = node.properties as WorldEnvironmentProperties;
  const resolved = useResolvedEnvironment(properties.environment);

  return (
    <group name={node.name}>
      {resolved && (
        // The Environment's pools, so a `.tres` Environment reads its own sub-resources.
        <SceneResourcesProvider
          internalResources={resolved.resources.internalResources}
          externalResources={resolved.resources.externalResources}
        >
          <EnvironmentLayer settings={resolved.settings} sky={resolved.sky} />
        </SceneResourcesProvider>
      )}
      {children}
    </group>
  );
}
