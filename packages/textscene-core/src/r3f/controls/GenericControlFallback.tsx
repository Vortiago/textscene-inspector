/**
 * DOM placeholder for a Control node type with no registered component — the
 * 2D-overlay analogue of GenericNodeFallback. Renders a dashed-outline box so
 * the node stays visible (and laid out) in the overlay while still flagging it
 * as unimplemented.
 */

import type { CSSProperties } from 'react';
import type { ControlComponentProps } from './ControlComponentRegistry';
import type { ControlProperties } from '../../nodes/2d/ui/control/types';
import { useControlParent } from './ControlParentContext';
import { controlLayoutStyle } from './controlLayout';

const FALLBACK_STYLE: CSSProperties = {
  outline: '1px dashed #c792ea',
  minWidth: 24,
  minHeight: 18,
  boxSizing: 'border-box',
};

export function GenericControlFallback({ node, children }: ControlComponentProps) {
  const parentKind = useControlParent();
  const style = controlLayoutStyle(node.properties as unknown as ControlProperties, parentKind);
  return (
    <div data-control-type={node.type} data-control-fallback="true" style={{ ...style, ...FALLBACK_STYLE }}>
      {children}
    </div>
  );
}
