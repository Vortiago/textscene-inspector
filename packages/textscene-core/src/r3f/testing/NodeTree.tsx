/**
 * A parsed node and its descendants, each mounted through its registered component
 * under the node path the dispatcher would give it. Test-only: the build excludes
 * the `testing/` directories under `src`.
 */
import type { TscnNode } from '../../parser/types';
import { NodePathProvider } from '../contexts/NodePathContext';
import { VisibilityParentScope } from '../visibilityRange/VisibilityParentContext';
import { nodeComponentRegistry } from '../NodeComponentRegistry';

export function NodeTree({ node, path }: { node: TscnNode; path: string }) {
  const Component = nodeComponentRegistry.get(node.type);
  if (!Component)
    throw new Error(`expected a registered component for ${path}, got none for type ${node.type}`);
  return (
    <NodePathProvider path={path}>
      <VisibilityParentScope node={node} path={path}>
        <Component node={node}>
          {node.children.map((child) => (
            <NodeTree key={child.name} node={child} path={`${path}/${child.name}`} />
          ))}
        </Component>
      </VisibilityParentScope>
    </NodePathProvider>
  );
}
