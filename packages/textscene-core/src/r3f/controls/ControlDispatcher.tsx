/**
 * Recursive DOM walker that turns a Control subtree into nested <div>s — the
 * 2D analogue of NodeDispatcher. For each node it looks up the registered
 * Control component (GenericControlFallback when absent) and renders it with
 * its recursively-dispatched children; each component decides how to lay those
 * children out (a container provides its layout kind via ControlParentContext).
 */

import type { ReactNode } from 'react';
import type { TscnNode } from '../../parser/types';
import { controlComponentRegistry } from './ControlComponentRegistry';
import { GenericControlFallback } from './GenericControlFallback';

export interface ControlDispatcherProps {
  nodes: readonly TscnNode[];
}

export function ControlDispatcher({ nodes }: ControlDispatcherProps) {
  return (
    <>
      {nodes.map((node) => (
        <DispatchedControl key={node.name} node={node} />
      ))}
    </>
  );
}

function DispatchedControl({ node }: { node: TscnNode }): ReactNode {
  const Component = controlComponentRegistry.get(node.type) ?? GenericControlFallback;
  return (
    <Component node={node}>
      {node.children.length > 0 ? <ControlDispatcher nodes={node.children} /> : null}
    </Component>
  );
}
