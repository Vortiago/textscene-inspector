/** The node path of each node's visibility parent (`godot/visibilityParent.ts`), down the tree. */

import { createContext, useContext, type ReactNode } from 'react';
import { spaceFamilyOf } from '../../godot/parentSpace';
import { visibilityParentOf } from '../../godot/visibilityParent';
import type { TscnNode } from '../../parser/types';
import type { Node3DProperties } from '../../nodes/base/node3d/types';
import { useUniqueNamePaths } from '../useUniqueNames';

const VisibilityParentContext = createContext<string | null>(null);
VisibilityParentContext.displayName = 'VisibilityParentContext';

interface VisibilityParentScopeProps {
  node: TscnNode;
  path: string;
  children: ReactNode;
}

/** Gives `node`'s visibility parent to the node's own component and to its descendants. */
export function VisibilityParentScope({ node, path, children }: VisibilityParentScopeProps) {
  // Only a Node3D parent passes its visibility parent on (`node_3d.cpp:150`, `:1317`).
  if (spaceFamilyOf(node.type) !== 'Node3D') {
    return <VisibilityParentContext.Provider value={null}>{children}</VisibilityParentContext.Provider>;
  }
  const own = (node.properties as Node3DProperties).visibility_parent;
  if (own === undefined) return children;
  return (
    <OwnVisibilityParent path={path} relative={own}>
      {children}
    </OwnVisibilityParent>
  );
}

function OwnVisibilityParent({
  path,
  relative,
  children,
}: {
  path: string;
  relative: string;
  children: ReactNode;
}) {
  const visibilityParent = visibilityParentOf(path, relative, null, useUniqueNamePaths(path));
  return (
    <VisibilityParentContext.Provider value={visibilityParent}>{children}</VisibilityParentContext.Provider>
  );
}

/** The node path of the enclosing node's visibility parent, or null for none. */
export function useVisibilityParent(): string | null {
  return useContext(VisibilityParentContext);
}
