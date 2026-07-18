/**
 * <VBoxContainer> — stacks its children vertically (CSS flex column). Provides
 * the 'column' layout kind to its subtree so each child becomes a flex item
 * sized by its size_flags. `theme_override_constants/separation` → CSS gap,
 * BoxContainer `alignment` → justify-content.
 */

import { createContainerComponent } from '../../../../r3f/controls/createContainerComponent';
import { alignmentJustify } from '../shared/boxContainer';
import type { VBoxContainerProperties } from './types';

const DEFAULT_SEPARATION = 4; // Godot VBoxContainer default

export const VBoxContainer = createContainerComponent<VBoxContainerProperties>({
  typeName: 'VBoxContainer',
  kind: 'column',
  useStyle: (props) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: `${props.themeOverrideConstants?.separation ?? DEFAULT_SEPARATION}px`,
    justifyContent: alignmentJustify(props.alignment),
  }),
});
