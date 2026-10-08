/**
 * A parsed node and its descendants, each mounted through its registered component
 * under the node path the dispatcher would give it. Test-only: the build excludes
 * the `testing/` directories under `src`.
 */
import type { TscnNode } from '../../parser/types';
import { NodePathProvider } from '../contexts/NodePathContext';
import { TreeOrderProvider, type TreeOrder } from '../contexts/TreeOrderContext';
import { VisibilityParentScope } from '../visibilityRange/VisibilityParentContext';
import { nodeComponentRegistry } from '../NodeComponentRegistry';
import { ParentTypeProvider } from '../parentSpaceScope';

export function NodeTree({ node, path, order = [] }: { node: TscnNode; path: string; order?: TreeOrder }) {
  const Component = nodeComponentRegistry.get(node.type);
  if (!Component)
    throw new Error(`expected a registered component for ${path}, got none for type ${node.type}`);
  return (
    <TreeOrderProvider order={order}>
      <NodePathProvider path={path}>
        <VisibilityParentScope node={node} path={path}>
          <Component node={node}>
            <ParentTypeProvider value={node.type}>
              {node.children.map((child, i) => (
                <NodeTree
                  key={child.name}
                  node={child}
                  path={`${path}/${child.name}`}
                  order={[...order, i]}
                />
              ))}
            </ParentTypeProvider>
          </Component>
        </VisibilityParentScope>
      </NodePathProvider>
    </TreeOrderProvider>
  );
}
