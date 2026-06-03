/**
 * <GridContainer> — lays its children out in a CSS grid of N columns. Provides
 * the 'grid' layout kind to its subtree so each child becomes a grid item.
 * `theme_override_constants/h_separation` → column-gap,
 * `theme_override_constants/v_separation` → row-gap.
 */

import { createContainerComponent } from '../../../../r3f/controls/createContainerComponent';
import type { GridContainerProperties } from './types';

const DEFAULT_SEPARATION = 4; // Godot GridContainer default

export const GridContainer = createContainerComponent<GridContainerProperties>({
  typeName: 'GridContainer',
  kind: 'grid',
  useStyle: (props) => ({
    display: 'grid',
    gridTemplateColumns: `repeat(${props.columns ?? 1}, max-content)`,
    columnGap: `${props.themeOverrideConstants?.h_separation ?? DEFAULT_SEPARATION}px`,
    rowGap: `${props.themeOverrideConstants?.v_separation ?? DEFAULT_SEPARATION}px`,
  }),
});
