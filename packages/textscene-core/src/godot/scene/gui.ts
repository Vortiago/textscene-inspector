/**
 * The enums of Godot's GUI controls (`scene/gui/`) that the linter validates and the 2D UI solvers
 * branch on: TextureRect, NinePatchRect, AspectRatioContainer, ScrollContainer, ItemList, LineEdit,
 * ProgressBar, TextureProgressBar, LinkButton and ColorPicker. A label table keeps the spelling its
 * property's hint prints.
 */

import { enumNamesByValue, relabelEnumNames } from '../classdb/enumNames.js';

/**
 * `TextureRect::ExpandMode` (`texture_rect.h:39-46`, bound at `texture_rect.cpp:153-158`). The labels
 * come from the hint string at `texture_rect.cpp:148`.
 */
export enum TextureRectExpandMode {
  EXPAND_KEEP_SIZE = 0,
  EXPAND_IGNORE_SIZE = 1,
  EXPAND_FIT_WIDTH = 2,
  EXPAND_FIT_WIDTH_PROPORTIONAL = 3,
  EXPAND_FIT_HEIGHT = 4,
  EXPAND_FIT_HEIGHT_PROPORTIONAL = 5,
}

export const TEXTURE_RECT_EXPAND_MODE_NAMES = enumNamesByValue(TextureRectExpandMode);

/**
 * `NinePatchRect::AxisStretchMode` (`nine_patch_rect.h:39-43`, bound at `nine_patch_rect.cpp:86-88`)
 * and `StyleBoxTexture::AxisStretchMode`, in the same order. The labels come from the hint string both
 * axes share (`nine_patch_rect.cpp:83-84`).
 */
export enum AxisStretchMode {
  STRETCH = 0,
  TILE = 1,
  TILE_FIT = 2,
}

export const AXIS_STRETCH_MODE_NAMES = relabelEnumNames(
  enumNamesByValue(AxisStretchMode),
  (name) => `AXIS_STRETCH_MODE_${name}`
);

/**
 * `AspectRatioContainer::StretchMode` (`aspect_ratio_container.h:44-49`), matching the hint at
 * `aspect_ratio_container.cpp:189`: "Width Controls Height,Height Controls Width,Fit,Cover".
 */
export enum AspectRatioStretchMode {
  STRETCH_WIDTH_CONTROLS_HEIGHT = 0,
  STRETCH_HEIGHT_CONTROLS_WIDTH = 1,
  STRETCH_FIT = 2,
  STRETCH_COVER = 3,
}

export const ASPECT_RATIO_STRETCH_MODE_NAMES = enumNamesByValue(AspectRatioStretchMode);

/** `ScrollContainer::ScrollMode` (`scroll_container.h:44-50`), for the two scroll mode properties. */
export enum ScrollMode {
  DISABLED = 0,
  AUTO = 1,
  SHOW_ALWAYS = 2,
  SHOW_NEVER = 3,
  RESERVE = 4,
}

export const SCROLL_MODE_NAMES = enumNamesByValue(ScrollMode);

/** `ScrollContainer::ScrollHintMode` (`scroll_container.h:52-57`), used only by `scroll_hint_mode`. */
export enum ScrollContainerScrollHintMode {
  DISABLED = 0,
  ALL = 1,
  TOP_AND_LEFT = 2,
  BOTTOM_AND_RIGHT = 3,
}

export const SCROLL_CONTAINER_SCROLL_HINT_MODE_NAMES = enumNamesByValue(ScrollContainerScrollHintMode);

/** `ItemList::SelectMode` (`item_list.h:48-50`), in declaration order. */
enum ItemListSelectMode {
  SELECT_SINGLE = 0,
  SELECT_MULTI = 1,
  SELECT_TOGGLE = 2,
}

export const ITEM_LIST_SELECT_MODE_NAMES = enumNamesByValue(ItemListSelectMode);

/** `ItemList::IconMode` (`item_list.h:43-44`), in declaration order. */
enum ItemListIconMode {
  ICON_MODE_TOP = 0,
  ICON_MODE_LEFT = 1,
}

export const ITEM_LIST_ICON_MODE_NAMES = enumNamesByValue(ItemListIconMode);

/** `ItemList::ScrollHintMode` (`item_list.h:54-57`), in declaration order. */
enum ItemListScrollHintMode {
  SCROLL_HINT_MODE_DISABLED = 0,
  SCROLL_HINT_MODE_BOTH = 1,
  SCROLL_HINT_MODE_TOP = 2,
  SCROLL_HINT_MODE_BOTTOM = 3,
}

export const ITEM_LIST_SCROLL_HINT_MODE_NAMES = enumNamesByValue(ItemListScrollHintMode);

/** `LineEdit::VirtualKeyboardType` (`line_edit.h`, bound at `line_edit.cpp:3470-3477`). */
enum LineEditVirtualKeyboardType {
  KEYBOARD_TYPE_DEFAULT = 0,
  KEYBOARD_TYPE_MULTILINE = 1,
  KEYBOARD_TYPE_NUMBER = 2,
  KEYBOARD_TYPE_NUMBER_DECIMAL = 3,
  KEYBOARD_TYPE_PHONE = 4,
  KEYBOARD_TYPE_EMAIL_ADDRESS = 5,
  KEYBOARD_TYPE_PASSWORD = 6,
  KEYBOARD_TYPE_URL = 7,
}

export const LINE_EDIT_VIRTUAL_KEYBOARD_TYPE_NAMES = enumNamesByValue(LineEditVirtualKeyboardType);

/**
 * `LineEdit::ExpandMode` (bound at `line_edit.cpp:3479-3481`), hinted "Original,Fit to Text,Fit to
 * LineEdit" at `line_edit.cpp:3527`.
 */
enum LineEditExpandMode {
  EXPAND_MODE_ORIGINAL_SIZE = 0,
  EXPAND_MODE_FIT_TO_TEXT = 1,
  EXPAND_MODE_FIT_TO_LINE_EDIT = 2,
}

export const LINE_EDIT_EXPAND_MODE_NAMES = enumNamesByValue(LineEditExpandMode);

/** `ProgressBar::FillMode` (`progress_bar.h:62-68`, bound at `progress_bar.cpp:275-278`). */
export enum ProgressBarFillMode {
  BEGIN_TO_END = 0,
  END_TO_BEGIN = 1,
  TOP_TO_BOTTOM = 2,
  BOTTOM_TO_TOP = 3,
}

export const PROGRESS_BAR_FILL_MODE_NAMES = relabelEnumNames(
  enumNamesByValue(ProgressBarFillMode),
  (name) => `FILL_${name}`
);

/**
 * `TextureProgressBar::FillMode` (`texture_progress_bar.h:48-59`, bound at
 * `texture_progress_bar.cpp:716-724`). The labels come from the hint string at
 * `texture_progress_bar.cpp:691`.
 */
export enum TextureProgressBarFillMode {
  LEFT_TO_RIGHT = 0,
  RIGHT_TO_LEFT = 1,
  TOP_TO_BOTTOM = 2,
  BOTTOM_TO_TOP = 3,
  CLOCKWISE = 4,
  COUNTER_CLOCKWISE = 5,
  BILINEAR_LEFT_AND_RIGHT = 6,
  BILINEAR_TOP_AND_BOTTOM = 7,
  CLOCKWISE_AND_COUNTER_CLOCKWISE = 8,
}

export const TEXTURE_PROGRESS_BAR_FILL_MODE_NAMES = relabelEnumNames(
  enumNamesByValue(TextureProgressBarFillMode),
  (name) => `FILL_${name}`
);

/** `LinkButton::UnderlineMode` (hinted at `link_button.cpp:345`). */
export enum LinkButtonUnderlineMode {
  UNDERLINE_MODE_ALWAYS = 0,
  UNDERLINE_MODE_ON_HOVER = 1,
  UNDERLINE_MODE_NEVER = 2,
}

export const LINK_BUTTON_UNDERLINE_MODE_NAMES = enumNamesByValue(LinkButtonUnderlineMode);

/**
 * `ColorPicker::ColorModeType` (`color_picker.h:105-107`), hinted "RGB,HSV,LINEAR,OKHSL" at
 * `color_picker.cpp:1996`. `MODE_RAW` is a deprecated alias for 2, left out so 2 keeps the name
 * MODE_LINEAR.
 */
enum ColorPickerColorMode {
  MODE_RGB = 0,
  MODE_HSV = 1,
  MODE_LINEAR = 2,
  MODE_OKHSL = 3,
}

export const COLOR_PICKER_COLOR_MODE_NAMES = enumNamesByValue(ColorPickerColorMode);

/**
 * `ColorPicker::PickerShapeType` (`color_picker.h:113-122`). The hint at `color_picker.cpp:1998` is
 * "HSV Rectangle,HSV Rectangle Wheel,VHS Circle,OKHSL Circle,OK HS Rectangle:5,OK HL Rectangle,
 * None:4", so by value it covers 0-6.
 */
enum ColorPickerShape {
  SHAPE_HSV_RECTANGLE = 0,
  SHAPE_HSV_WHEEL = 1,
  SHAPE_VHS_CIRCLE = 2,
  SHAPE_OKHSL_CIRCLE = 3,
  SHAPE_NONE = 4,
  SHAPE_OK_HS_RECTANGLE = 5,
  SHAPE_OK_HL_RECTANGLE = 6,
}

export const COLOR_PICKER_SHAPE_NAMES = enumNamesByValue(ColorPickerShape);
