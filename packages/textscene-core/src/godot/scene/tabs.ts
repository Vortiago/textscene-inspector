/** Godot 4.6.3's TabBar and TabContainer facts a scene's properties carry. */

import { enumNamesByValue, pascalCaseLabel, relabelEnumNames } from '../classdb/enumNames.js';

/** `TabBar::AlignmentMode` (`scene/gui/tab_bar.h:43-48`), `ALIGNMENT_MAX` left out as a size marker. */
const AlignmentMode = {
  LEFT: 0,
  CENTER: 1,
  RIGHT: 2,
} as const;

/** Each tab alignment by its integer, spelled as its constant without `ALIGNMENT_`. */
export const TAB_BAR_ALIGNMENT_NAMES = enumNamesByValue(AlignmentMode);

/** Each tab alignment by its integer, as `tab_container.cpp:1208` hints it. */
export const TAB_BAR_ALIGNMENT_HINT_NAMES = relabelEnumNames(TAB_BAR_ALIGNMENT_NAMES, pascalCaseLabel);

/** `TabBar::CloseButtonDisplayPolicy` (`tab_bar.h:50-55`), `CLOSE_BUTTON_MAX` left out. */
const CloseButtonDisplayPolicy = {
  SHOW_NEVER: 0,
  SHOW_ACTIVE_ONLY: 1,
  SHOW_ALWAYS: 2,
} as const;

/** Each close button policy by its integer, spelled as its constant without `CLOSE_BUTTON_`. */
export const TAB_BAR_CLOSE_BUTTON_DISPLAY_POLICY_NAMES = enumNamesByValue(CloseButtonDisplayPolicy);

/** `TabContainer::TabPosition` (`scene/gui/tab_container.h:42-46`), `POSITION_MAX` left out. */
const TabPosition = {
  TOP: 0,
  BOTTOM: 1,
} as const;

/** Each tabs position by its integer, as `tab_container.cpp:1210` hints it. */
export const TAB_CONTAINER_TABS_POSITION_NAMES = relabelEnumNames(
  enumNamesByValue(TabPosition),
  pascalCaseLabel
);
