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
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { useControlParent, ControlParentProvider } from '../../../../r3f/controls/ControlParentContext';
import { controlStyle } from '../../../../r3f/controls/controlLayout';
import { useOptionalSelection } from '../../../../r3f/contexts/SelectionContext';
import { joinPath } from '../../../../utils/nodePath';
import type { ControlProperties } from '../control/types';
import type { TscnNode } from '../../../../parser/types';
import type { GridContainerProperties } from './types';

const DEFAULT_SEPARATION = 4; // Godot GridContainer default
const SIZE_FLAG_EXPAND = 2;
const NO_HIDDEN: ReadonlySet<string> = new Set();

export function GridContainer({ node, path, children }: ControlComponentProps) {
  const props = node.properties as GridContainerProperties;
  const parentKind = useControlParent();
  const columns = Math.max(1, props.columns ?? 1);
  const hiddenNodePaths = useOptionalSelection()?.hiddenNodePaths ?? NO_HIDDEN;

  // CSS grid auto-places only the children that ControlDispatcher actually
  // renders as grid cells: registered Control types that aren't hidden. Logic
  // nodes / timers render `display:contents` (no cell) and hidden nodes render
  // nothing, so counting them would shift the EXPAND column off its real item.
  const items = node.children.filter((child) => {
    if (!controlComponentRegistry.has(child.type)) return false;
    const childPath = path ? joinPath(path, child.name) : child.name;
    return !hiddenNodePaths.has(childPath);
  });

  const style: CSSProperties = controlStyle(props, parentKind, {
    display: 'grid',
    gridTemplateColumns: gridColumnTemplate(items, columns),
    columnGap: `${props.themeOverrideConstants?.h_separation ?? DEFAULT_SEPARATION}px`,
    rowGap: `${props.themeOverrideConstants?.v_separation ?? DEFAULT_SEPARATION}px`,
  });

  return (
    <div data-control-type="GridContainer" data-node-name={node.name} style={style}>
      <ControlParentProvider kind="grid">{children}</ControlParentProvider>
    </div>
  );
}

/**
 * Build `grid-template-columns`: `1fr` for any column with an EXPAND grid item,
 * else `max-content`. `items` must already be the children that become grid
 * cells, in order, so item `k` lands in column `k % columns` (CSS auto-place).
 */
function gridColumnTemplate(items: readonly TscnNode[], columns: number): string {
  const expand = new Array<boolean>(columns).fill(false);
  items.forEach((child, k) => {
    const flags = (child.properties as ControlProperties | undefined)?.sizeFlagsHorizontal;
    if (flags !== undefined && (flags & SIZE_FLAG_EXPAND) !== 0) {
      expand[k % columns] = true;
    }
  });
  return expand.map((isExpand) => (isExpand ? '1fr' : 'max-content')).join(' ');
}
