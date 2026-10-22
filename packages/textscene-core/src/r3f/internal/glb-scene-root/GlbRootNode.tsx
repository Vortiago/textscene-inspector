/**
 * What a node that instances a lone GLB mounts for the GLB. The instancing node is the GLB root, so
 * the GLB's component mounts at that node's path with no wrapper of its own: a second wrapper would
 * register a second object at that path.
 */
import type { ReactNode } from 'react';
import type { LiveNode } from '../../../resources/liveNode.js';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import { MissingResourcePlaceholder } from '../../components/MissingResourcePlaceholder.js';
import { useCanvasWorkspace } from '../../contexts/CanvasWorkspaceContext.js';
import { nodeComponentRegistry } from '../../NodeComponentRegistry.js';
import { drawsInWorkspace } from '../../nodeWorkspaceVisibility.js';
import { GenericNodeFallback } from '../generic-node-fallback/index';

/** `node` is the synthesised `GLBSceneRoot` of the instanced `.glb`. */
export function GlbRootNode({ node }: { node: LiveNode }): ReactNode {
  const workspace = useCanvasWorkspace();
  if (!drawsInWorkspace(node.type, workspace)) return null;
  const Component = nodeComponentRegistry.get(node.type) ?? GenericNodeFallback;
  // The boundary keeps a render error to the GLB, so the instancing node and its children stay.
  return (
    <ErrorBoundary
      resetKeys={[node]}
      fallback={() => <MissingResourcePlaceholder shape="box" name={node.name} />}
    >
      <Component node={node} />
    </ErrorBoundary>
  );
}
