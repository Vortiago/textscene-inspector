/**
 * <GridContainer> — lays its children out in a CSS grid of N columns. Provides
 * the 'grid' layout kind to its subtree so each child becomes a grid item.
 * `theme_override_constants/h_separation` → column-gap,
 * `theme_override_constants/v_separation` → row-gap.
 *
 * Column sizing follows Godot: each column is content-sized (`max-content`)
 * unless it contains a child with the horizontal SIZE_EXPAND flag, in which
 * case it grows to fill the remaining width (`1fr`). Children fill the grid
 * left-to-right, so a child's column is `index % columns`. Unlike the other
 * containers this needs the child nodes (not just props), so it doesn't use the
 * createContainerComponent factory.
 */

import type { CSSProperties } from 'react';
import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useControlParent, ControlParentProvider } from '../../../../r3f/controls/ControlParentContext';
import { controlLayoutStyle } from '../../../../r3f/controls/controlLayout';
import type { ControlProperties } from '../control/types';
import type { TscnNode } from '../../../../parser/types';
import type { GridContainerProperties } from './types';

const DEFAULT_SEPARATION = 4; // Godot GridContainer default
const SIZE_FLAG_EXPAND = 2;

export function GridContainer({ node, children }: ControlComponentProps) {
  const props = node.properties as GridContainerProperties;
  const parentKind = useControlParent();
  const columns = Math.max(1, props.columns ?? 1);

  const style: CSSProperties = {
    ...controlLayoutStyle(props, parentKind),
    display: 'grid',
    gridTemplateColumns: gridColumnTemplate(node.children, columns),
    columnGap: `${props.themeOverrideConstants?.h_separation ?? DEFAULT_SEPARATION}px`,
    rowGap: `${props.themeOverrideConstants?.v_separation ?? DEFAULT_SEPARATION}px`,
  };

  return (
    <div data-control-type="GridContainer" data-node-name={node.name} style={style}>
      <ControlParentProvider kind="grid">{children}</ControlParentProvider>
    </div>
  );
}

/** Build `grid-template-columns`: `1fr` for any column with an EXPAND child, else `max-content`. */
function gridColumnTemplate(children: readonly TscnNode[], columns: number): string {
  const expand = new Array<boolean>(columns).fill(false);
  children.forEach((child, i) => {
    const flags = (child.properties as ControlProperties | undefined)?.sizeFlagsHorizontal;
    if (flags !== undefined && (flags & SIZE_FLAG_EXPAND) !== 0) {
      expand[i % columns] = true;
    }
  });
  return expand.map((isExpand) => (isExpand ? '1fr' : 'max-content')).join(' ');
}
