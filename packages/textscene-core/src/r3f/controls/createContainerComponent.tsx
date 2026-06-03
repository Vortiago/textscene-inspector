/**
 * Factory for the 2D-overlay container Controls (HBox/VBox/Grid/Margin/
 * Scroll/Center). Every container repeats the same ceremony: cast
 * `node.properties`, read the parent layout kind, merge `controlLayoutStyle`
 * with a container-specific style, then render a typed `<div>` that provides a
 * child layout kind to its subtree via `ControlParentProvider`. This folds
 * that ceremony into one place so each container is just a config — its
 * `typeName`, the `kind` it imposes on its children, and a `useStyle` hook
 * returning the bits that differ (flex direction, gap, padding, …).
 */
import type { CSSProperties } from 'react';
import type { ControlComponentProps } from './ControlComponentRegistry';
import { useControlParent, ControlParentProvider } from './ControlParentContext';
import { controlLayoutStyle } from './controlLayout';
import type { ParentLayoutKind } from './controlLayout';
import type { ControlComponent } from './ControlComponentRegistry';
import type { ControlProperties } from '../../nodes/2d/ui/control/types';

export interface ContainerConfig<P extends ControlProperties = ControlProperties> {
  /** Godot type name, e.g. 'HBoxContainer'. */
  typeName: string;
  /** Layout kind imposed on the container's children. */
  kind: ParentLayoutKind;
  /**
   * The container-specific style merged on top of the shared layout style.
   * Named `useStyle` because it may call hooks (e.g. PanelContainer-style
   * resource lookups); it runs unconditionally on every render.
   */
  useStyle?: (props: P) => CSSProperties;
}

export function createContainerComponent<P extends ControlProperties = ControlProperties>(
  config: ContainerConfig<P>
): ControlComponent {
  function Container({ node, children }: ControlComponentProps) {
    const props = node.properties as P;
    const parentKind = useControlParent();
    const style: CSSProperties = {
      ...controlLayoutStyle(props, parentKind),
      ...(config.useStyle ? config.useStyle(props) : {}),
    };
    return (
      <div data-control-type={config.typeName} data-node-name={node.name} style={style}>
        <ControlParentProvider kind={config.kind}>{children}</ControlParentProvider>
      </div>
    );
  }
  Container.displayName = config.typeName;
  return Container;
}
