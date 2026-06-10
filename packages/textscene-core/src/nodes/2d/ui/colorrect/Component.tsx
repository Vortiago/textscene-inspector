/** <ColorRect> — a positioned <div> filled with the node's `color`. */

import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useControlParent } from '../../../../r3f/controls/ControlParentContext';
import { controlLayoutStyle } from '../../../../r3f/controls/controlLayout';
import { colorToCss } from '../../../../r3f/controls/styleBoxToCss';
import type { ColorRectProperties } from './types';

export function ColorRect({ node, children }: ControlComponentProps) {
  const props = node.properties as ColorRectProperties;
  const parentKind = useControlParent();
  const background = props.color ? colorToCss(props.color) : undefined;
  const style = {
    ...controlLayoutStyle(props, parentKind),
    backgroundColor: background ?? 'transparent',
  };
  return (
    <div data-control-type="ColorRect" data-node-name={node.name} style={style}>
      {children}
    </div>
  );
}
