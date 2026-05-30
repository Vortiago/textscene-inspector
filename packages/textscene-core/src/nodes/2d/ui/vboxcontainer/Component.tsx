/**
 * <VBoxContainer> — stacks its children vertically (CSS flex column). Provides
 * the 'column' layout kind to its subtree so each child becomes a flex item
 * sized by its size_flags. `theme_override_constants/separation` → CSS gap.
 */

import type { CSSProperties } from 'react';
import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useControlParent, ControlParentProvider } from '../../../../r3f/controls/ControlParentContext';
import { controlLayoutStyle } from '../../../../r3f/controls/controlLayout';
import type { ControlProperties } from '../control/types';

const DEFAULT_SEPARATION = 4; // Godot VBoxContainer default

export function VBoxContainer({ node, children }: ControlComponentProps) {
  const props = node.properties as ControlProperties;
  const parentKind = useControlParent();
  const separation = props.themeOverrideConstants?.separation ?? DEFAULT_SEPARATION;
  const style: CSSProperties = {
    ...controlLayoutStyle(props, parentKind),
    display: 'flex',
    flexDirection: 'column',
    gap: `${separation}px`,
  };
  return (
    <div data-control-type="VBoxContainer" data-node-name={node.name} style={style}>
      <ControlParentProvider kind="column">{children}</ControlParentProvider>
    </div>
  );
}
