/**
 * <HBoxContainer> — stacks its children horizontally (CSS flex row). Provides
 * the 'row' layout kind to its subtree so each child becomes a flex item sized
 * by its size_flags. `theme_override_constants/separation` → CSS gap.
 */

import { createContainerComponent } from '../../../../r3f/controls/createContainerComponent';
import type { ControlProperties } from '../control/types';

const DEFAULT_SEPARATION = 4; // Godot HBoxContainer default

export const HBoxContainer = createContainerComponent<ControlProperties>({
  typeName: 'HBoxContainer',
  kind: 'row',
  useStyle: (props) => ({
    display: 'flex',
    flexDirection: 'row',
    gap: `${props.themeOverrideConstants?.separation ?? DEFAULT_SEPARATION}px`,
  }),
});
