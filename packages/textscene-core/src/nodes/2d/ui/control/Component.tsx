/**
 * <Control> — base Godot UI node rendered as a positioned <div>. Establishes a
 * containing block for its children (which anchor against it) and resets the
 * child layout regime to 'free' (Control is not a container).
 */

import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useControlParent, ControlParentProvider } from '../../../../r3f/controls/ControlParentContext';
import { controlLayoutStyle } from '../../../../r3f/controls/controlLayout';
import type { ControlProperties } from './types';

export function Control({ node, children }: ControlComponentProps) {
  const props = node.properties as ControlProperties;
  const parentKind = useControlParent();
  const style = controlLayoutStyle(props, parentKind);
  return (
    <div data-control-type="Control" data-node-name={node.name} style={style}>
      <ControlParentProvider kind="free">{children}</ControlParentProvider>
    </div>
  );
}
