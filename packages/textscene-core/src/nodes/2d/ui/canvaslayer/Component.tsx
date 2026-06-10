/**
 * <CanvasLayer> — a full-rect passthrough layer that hosts Control children.
 * It is not a Control, so it has no anchors/offsets; it simply fills the overlay
 * and provides the 'free' layout kind so its Control children anchor against the
 * viewport.
 */

import type { CSSProperties } from 'react';
import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { ControlParentProvider } from '../../../../r3f/controls/ControlParentContext';
import type { CanvasLayerProperties } from './types';

export function CanvasLayer({ node, children }: ControlComponentProps) {
  const props = node.properties as CanvasLayerProperties;
  const style: CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: props.visible === false ? 'none' : undefined,
  };
  return (
    <div data-control-type="CanvasLayer" data-node-name={node.name} style={style}>
      <ControlParentProvider kind="free">{children}</ControlParentProvider>
    </div>
  );
}
