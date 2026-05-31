/**
 * <CenterContainer> — centers its single child both horizontally and vertically
 * (CSS flex with centered main + cross axis). Provides the 'center' layout kind
 * to its subtree so the child positions itself relative to the centered box.
 */

import type { CSSProperties } from 'react';
import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useControlParent, ControlParentProvider } from '../../../../r3f/controls/ControlParentContext';
import { controlLayoutStyle } from '../../../../r3f/controls/controlLayout';
import type { ControlProperties } from '../control/types';

export function CenterContainer({ node, children }: ControlComponentProps) {
  const props = node.properties as ControlProperties;
  const parentKind = useControlParent();
  const style: CSSProperties = {
    ...controlLayoutStyle(props, parentKind),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
  return (
    <div data-control-type="CenterContainer" data-node-name={node.name} style={style}>
      <ControlParentProvider kind="center">{children}</ControlParentProvider>
    </div>
  );
}
