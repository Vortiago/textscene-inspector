/**
 * <ScrollContainer> — clips its content and scrolls when it overflows
 * (CSS `overflow: auto`). Provides the 'block' layout kind so its single child
 * flows at its natural size and scrolls within the container's rect.
 */

import type { CSSProperties } from 'react';
import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useControlParent, ControlParentProvider } from '../../../../r3f/controls/ControlParentContext';
import { controlLayoutStyle } from '../../../../r3f/controls/controlLayout';
import type { ControlProperties } from '../control/types';

export function ScrollContainer({ node, children }: ControlComponentProps) {
  const props = node.properties as ControlProperties;
  const parentKind = useControlParent();
  const style: CSSProperties = {
    ...controlLayoutStyle(props, parentKind),
    overflow: 'auto',
  };
  return (
    <div data-control-type="ScrollContainer" data-node-name={node.name} style={style}>
      <ControlParentProvider kind="block">{children}</ControlParentProvider>
    </div>
  );
}
