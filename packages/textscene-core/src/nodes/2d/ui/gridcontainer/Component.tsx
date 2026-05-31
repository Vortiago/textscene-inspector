/**
 * <GridContainer> — lays its children out in a CSS grid of N columns. Provides
 * the 'grid' layout kind to its subtree so each child becomes a grid item.
 * `theme_override_constants/h_separation` → column-gap,
 * `theme_override_constants/v_separation` → row-gap.
 */

import type { CSSProperties } from 'react';
import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useControlParent, ControlParentProvider } from '../../../../r3f/controls/ControlParentContext';
import { controlLayoutStyle } from '../../../../r3f/controls/controlLayout';
import type { GridContainerProperties } from './types';

const DEFAULT_SEPARATION = 4; // Godot GridContainer default

export function GridContainer({ node, children }: ControlComponentProps) {
  const props = node.properties as GridContainerProperties;
  const parentKind = useControlParent();
  const columns = props.columns ?? 1;
  const hSeparation = props.themeOverrideConstants?.h_separation ?? DEFAULT_SEPARATION;
  const vSeparation = props.themeOverrideConstants?.v_separation ?? DEFAULT_SEPARATION;
  const style: CSSProperties = {
    ...controlLayoutStyle(props, parentKind),
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, max-content)`,
    columnGap: `${hSeparation}px`,
    rowGap: `${vSeparation}px`,
  };
  return (
    <div data-control-type="GridContainer" data-node-name={node.name} style={style}>
      <ControlParentProvider kind="grid">{children}</ControlParentProvider>
    </div>
  );
}
