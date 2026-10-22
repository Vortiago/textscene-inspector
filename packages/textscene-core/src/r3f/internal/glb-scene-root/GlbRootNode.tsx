/**
 * What a node that instances a lone GLB mounts for the GLB. The instancing node is the GLB root, so
 * the GLB's component mounts at that node's path with no wrapper of its own: a second wrapper would
 * register a second object at that path.
 */
import type { ReactNode } from 'react';
import type { LiveNode } from '../../../resources/liveNode.js';
import { GuardedNodeComponent } from '../../components/GuardedNodeComponent.js';
import { useCanvasWorkspace } from '../../contexts/CanvasWorkspaceContext.js';
import { drawsInWorkspace } from '../../nodeWorkspaceVisibility.js';

/** `node` is the synthesised `GLBSceneRoot` of the instanced `.glb`. */
export function GlbRootNode({ node }: { node: LiveNode }): ReactNode {
  const workspace = useCanvasWorkspace();
  if (!drawsInWorkspace(node.type, workspace)) return null;
  return <GuardedNodeComponent node={node} />;
}
