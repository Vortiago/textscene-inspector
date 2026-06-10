/**
 * Recursive DOM walker that turns a Control subtree into nested <div>s — the
 * 2D analogue of NodeDispatcher. For each node it looks up the registered
 * Control component (GenericControlFallback when absent) and renders it with
 * its recursively-dispatched children; each component decides how to lay those
 * children out (a container provides its layout kind via ControlParentContext).
 *
 * Honors the scene-tree eye toggle the same way NodeDispatcher does in 3D: a
 * node whose path is in `SelectionContext.hiddenNodePaths` (and its subtree) is
 * not rendered. Paths follow the tree scheme — root = node name, child =
 * `parent/child` — so a single hidden set drives both viewports.
 */

import type { ReactNode } from 'react';
import type { TscnNode } from '../../parser/types';
import { joinPath } from '../../utils/nodePath';
import { useOptionalSelection } from '../contexts/SelectionContext';
import { controlComponentRegistry } from './ControlComponentRegistry';
import { GenericControlFallback } from './GenericControlFallback';

const NO_HIDDEN: ReadonlySet<string> = new Set();

export interface ControlDispatcherProps {
  nodes: readonly TscnNode[];
  /** Path of the parent node; '' for scene roots. Children join onto it. */
  parentPath?: string;
}

export function ControlDispatcher({ nodes, parentPath = '' }: ControlDispatcherProps) {
  // Optional: the overlay still renders standalone (no provider → nothing hidden).
  const hiddenNodePaths = useOptionalSelection()?.hiddenNodePaths ?? NO_HIDDEN;
  return (
    <>
      {nodes.map((node) => {
        const path = parentPath ? joinPath(parentPath, node.name) : node.name;
        if (hiddenNodePaths.has(path)) return null;
        return <DispatchedControl key={node.name} node={node} path={path} />;
      })}
    </>
  );
}

function DispatchedControl({ node, path }: { node: TscnNode; path: string }): ReactNode {
  const Component = controlComponentRegistry.get(node.type) ?? GenericControlFallback;
  return (
    <Component node={node} path={path}>
      {node.children.length > 0 ? (
        <ControlDispatcher nodes={node.children} parentPath={path} />
      ) : null}
    </Component>
  );
}
