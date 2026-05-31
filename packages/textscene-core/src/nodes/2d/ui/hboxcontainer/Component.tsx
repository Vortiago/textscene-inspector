/**
 * <HBoxContainer> — stacks its children horizontally (CSS flex row). Provides
 * the 'row' layout kind to its subtree so each child becomes a flex item sized
 * by its size_flags. `theme_override_constants/separation` → CSS gap.
 */

import type { CSSProperties } from 'react';
import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useControlParent, ControlParentProvider } from '../../../../r3f/controls/ControlParentContext';
import { controlLayoutStyle } from '../../../../r3f/controls/controlLayout';
import type { ControlProperties } from '../control/types';

const DEFAULT_SEPARATION = 4; // Godot HBoxContainer default

export function HBoxContainer({ node, children }: ControlComponentProps) {
  const props = node.properties as ControlProperties;
  const parentKind = useControlParent();
  const separation = props.themeOverrideConstants?.separation ?? DEFAULT_SEPARATION;
  const style: CSSProperties = {
    ...controlLayoutStyle(props, parentKind),
    display: 'flex',
    flexDirection: 'row',
    gap: `${separation}px`,
  };
  return (
    <div data-control-type="HBoxContainer" data-node-name={node.name} style={style}>
      <ControlParentProvider kind="row">{children}</ControlParentProvider>
    </div>
  );
}
