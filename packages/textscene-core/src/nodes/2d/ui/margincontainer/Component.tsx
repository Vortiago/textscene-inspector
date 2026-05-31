/**
 * <MarginContainer> — pads its single child. The four margins come from
 * `theme_override_constants/margin_{left,top,right,bottom}` → CSS padding.
 * Provides the 'margin' layout kind so the child fills the padded box.
 */

import type { CSSProperties } from 'react';
import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useControlParent, ControlParentProvider } from '../../../../r3f/controls/ControlParentContext';
import { controlLayoutStyle } from '../../../../r3f/controls/controlLayout';
import type { ControlProperties } from '../control/types';

export function MarginContainer({ node, children }: ControlComponentProps) {
  const props = node.properties as ControlProperties;
  const parentKind = useControlParent();
  const c = props.themeOverrideConstants ?? {};
  const style: CSSProperties = {
    ...controlLayoutStyle(props, parentKind),
    display: 'flex',
    flexDirection: 'column',
    padding: `${c.margin_top ?? 0}px ${c.margin_right ?? 0}px ${c.margin_bottom ?? 0}px ${c.margin_left ?? 0}px`,
  };
  return (
    <div data-control-type="MarginContainer" data-node-name={node.name} style={style}>
      <ControlParentProvider kind="margin">{children}</ControlParentProvider>
    </div>
  );
}
