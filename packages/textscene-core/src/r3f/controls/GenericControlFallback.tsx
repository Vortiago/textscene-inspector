/**
 * Passthrough for a node type with no registered Control component. With the
 * full Control set implemented, the nodes that reach here are non-Control
 * (logic `Node`s, timers) or unresolved instance nodes — none of which should
 * paint a box in the overlay. We render `display: contents` so the node is
 * visually absent while its Control children (if any) still flow in the parent's
 * layout. The data attributes keep it greppable; a *registered* Control type
 * reaching here would be a bug (the controls-ui-overlay test asserts it never does).
 */

import type { CSSProperties } from 'react';
import type { ControlComponentProps } from './ControlComponentRegistry';

const PASSTHROUGH: CSSProperties = { display: 'contents' };

export function GenericControlFallback({ node, children }: ControlComponentProps) {
  return (
    <div data-control-passthrough="true" data-control-type={node.type} style={PASSTHROUGH}>
      {children}
    </div>
  );
}
