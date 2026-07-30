/**
 * <VBoxContainer> — stacks its children vertically (CSS flex column). Provides
 * the 'column' layout kind to its subtree so each child becomes a flex item
 * sized by its size_flags. `theme_override_constants/separation` → CSS gap,
 * BoxContainer `alignment` → justify-content.
 */

import { createContainerComponent } from '../../../../r3f/controls/createContainerComponent';
import { useGodotTheme } from '../../../../r3f/controls/useGodotTheme';
import { alignmentJustify } from '../shared/boxContainer';
import type { VBoxContainerProperties } from './types';

export const VBoxContainer = createContainerComponent<VBoxContainerProperties>({
  typeName: 'VBoxContainer',
  kind: 'column',
  useStyle: (props) => {
    // Called unconditionally, before the `??` that would otherwise short-circuit
    // it: a hook behind a property test would change hook order the moment a
    // scene gained or lost its override.
    const theme = useGodotTheme();
    return {
      display: 'flex',
      flexDirection: 'column',
      // A `theme_override_constants/separation` is used verbatim — Godot returns
      // an override as authored — so only the theme fallback follows the scale.
      gap: `${props.themeOverrideConstants?.separation ?? theme.separation}px`,
      justifyContent: alignmentJustify(props.alignment),
    };
  },
});
