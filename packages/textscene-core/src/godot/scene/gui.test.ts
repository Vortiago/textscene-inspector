import { describe, expect, it } from 'vitest';
import {
  ASPECT_RATIO_STRETCH_MODE_NAMES,
  AXIS_STRETCH_MODE_NAMES,
  BASE_BUTTON_ACTION_MODE_NAMES,
  COLOR_PICKER_COLOR_MODE_NAMES,
  COLOR_PICKER_SHAPE_NAMES,
  FLOW_CONTAINER_LAST_WRAP_ALIGNMENT_NAMES,
  FOLDABLE_CONTAINER_TITLE_POSITION_NAMES,
  GRAPH_EDIT_GRID_PATTERN_NAMES,
  GRAPH_EDIT_PANNING_SCHEME_NAMES,
  ITEM_LIST_ICON_MODE_NAMES,
  ITEM_LIST_SCROLL_HINT_MODE_NAMES,
  ITEM_LIST_SELECT_MODE_NAMES,
  LINE_EDIT_EXPAND_MODE_NAMES,
  LINE_EDIT_VIRTUAL_KEYBOARD_TYPE_NAMES,
  LINK_BUTTON_UNDERLINE_MODE_NAMES,
  PROGRESS_BAR_FILL_MODE_NAMES,
  SCROLL_CONTAINER_SCROLL_HINT_MODE_NAMES,
  SCROLL_MODE_NAMES,
  SPLIT_CONTAINER_DRAGGER_VISIBILITY_NAMES,
  TEXT_EDIT_CARET_TYPE_NAMES,
  TEXT_EDIT_LINE_WRAPPING_MODE_NAMES,
  TEXTURE_PROGRESS_BAR_FILL_MODE_NAMES,
  TEXTURE_RECT_EXPAND_MODE_NAMES,
} from './gui';

describe('GUI control enum label tables', () => {
  it('names the TextureRect expand modes (texture_rect.h:39-46)', () => {
    expect(TEXTURE_RECT_EXPAND_MODE_NAMES).toEqual({
      0: 'EXPAND_KEEP_SIZE',
      1: 'EXPAND_IGNORE_SIZE',
      2: 'EXPAND_FIT_WIDTH',
      3: 'EXPAND_FIT_WIDTH_PROPORTIONAL',
      4: 'EXPAND_FIT_HEIGHT',
      5: 'EXPAND_FIT_HEIGHT_PROPORTIONAL',
    });
  });

  it('names the nine-patch axis stretch modes with the prefix their hint prints', () => {
    expect(AXIS_STRETCH_MODE_NAMES).toEqual({
      0: 'AXIS_STRETCH_MODE_STRETCH',
      1: 'AXIS_STRETCH_MODE_TILE',
      2: 'AXIS_STRETCH_MODE_TILE_FIT',
    });
  });

  it('names the AspectRatioContainer stretch modes (aspect_ratio_container.h:44-49)', () => {
    expect(ASPECT_RATIO_STRETCH_MODE_NAMES).toEqual({
      0: 'STRETCH_WIDTH_CONTROLS_HEIGHT',
      1: 'STRETCH_HEIGHT_CONTROLS_WIDTH',
      2: 'STRETCH_FIT',
      3: 'STRETCH_COVER',
    });
  });

  it('names the ScrollContainer scroll modes and scroll hint modes (scroll_container.h:44-57)', () => {
    expect(SCROLL_MODE_NAMES).toEqual({
      0: 'DISABLED',
      1: 'AUTO',
      2: 'SHOW_ALWAYS',
      3: 'SHOW_NEVER',
      4: 'RESERVE',
    });
    expect(SCROLL_CONTAINER_SCROLL_HINT_MODE_NAMES).toEqual({
      0: 'DISABLED',
      1: 'ALL',
      2: 'TOP_AND_LEFT',
      3: 'BOTTOM_AND_RIGHT',
    });
  });

  it('names the ItemList select, icon and scroll hint modes (item_list.h:43-57)', () => {
    expect(ITEM_LIST_SELECT_MODE_NAMES).toEqual({
      0: 'SELECT_SINGLE',
      1: 'SELECT_MULTI',
      2: 'SELECT_TOGGLE',
    });
    expect(ITEM_LIST_ICON_MODE_NAMES).toEqual({ 0: 'ICON_MODE_TOP', 1: 'ICON_MODE_LEFT' });
    expect(ITEM_LIST_SCROLL_HINT_MODE_NAMES).toEqual({
      0: 'SCROLL_HINT_MODE_DISABLED',
      1: 'SCROLL_HINT_MODE_BOTH',
      2: 'SCROLL_HINT_MODE_TOP',
      3: 'SCROLL_HINT_MODE_BOTTOM',
    });
  });

  it('names the LineEdit keyboard types and expand modes (line_edit.cpp:3470-3481)', () => {
    expect(LINE_EDIT_VIRTUAL_KEYBOARD_TYPE_NAMES[7]).toBe('KEYBOARD_TYPE_URL');
    expect(Object.keys(LINE_EDIT_VIRTUAL_KEYBOARD_TYPE_NAMES)).toHaveLength(8);
    expect(LINE_EDIT_EXPAND_MODE_NAMES).toEqual({
      0: 'EXPAND_MODE_ORIGINAL_SIZE',
      1: 'EXPAND_MODE_FIT_TO_TEXT',
      2: 'EXPAND_MODE_FIT_TO_LINE_EDIT',
    });
  });

  it('names the ProgressBar and TextureProgressBar fill modes with the FILL_ prefix', () => {
    expect(PROGRESS_BAR_FILL_MODE_NAMES).toEqual({
      0: 'FILL_BEGIN_TO_END',
      1: 'FILL_END_TO_BEGIN',
      2: 'FILL_TOP_TO_BOTTOM',
      3: 'FILL_BOTTOM_TO_TOP',
    });
    expect(TEXTURE_PROGRESS_BAR_FILL_MODE_NAMES[0]).toBe('FILL_LEFT_TO_RIGHT');
    expect(TEXTURE_PROGRESS_BAR_FILL_MODE_NAMES[8]).toBe('FILL_CLOCKWISE_AND_COUNTER_CLOCKWISE');
  });

  it('names the LinkButton underline modes (link_button.cpp:345)', () => {
    expect(LINK_BUTTON_UNDERLINE_MODE_NAMES).toEqual({
      0: 'UNDERLINE_MODE_ALWAYS',
      1: 'UNDERLINE_MODE_ON_HOVER',
      2: 'UNDERLINE_MODE_NEVER',
    });
  });

  it('names the ColorPicker modes without the MODE_RAW alias, so 2 stays MODE_LINEAR', () => {
    expect(COLOR_PICKER_COLOR_MODE_NAMES).toEqual({
      0: 'MODE_RGB',
      1: 'MODE_HSV',
      2: 'MODE_LINEAR',
      3: 'MODE_OKHSL',
    });
  });

  it('names the ColorPicker shapes by value, 0 to 6 (color_picker.h:113-122)', () => {
    expect(COLOR_PICKER_SHAPE_NAMES[4]).toBe('SHAPE_NONE');
    expect(COLOR_PICKER_SHAPE_NAMES[5]).toBe('SHAPE_OK_HS_RECTANGLE');
    expect(Object.keys(COLOR_PICKER_SHAPE_NAMES)).toHaveLength(7);
  });
});

describe('container and editor control enum label tables', () => {
  it('names the BaseButton action modes (base_button.h:43-46)', () => {
    expect(BASE_BUTTON_ACTION_MODE_NAMES).toEqual({
      0: 'ACTION_MODE_BUTTON_PRESS',
      1: 'ACTION_MODE_BUTTON_RELEASE',
    });
  });

  it('names the SplitContainer dragger visibilities (split_container.h:78-82)', () => {
    expect(SPLIT_CONTAINER_DRAGGER_VISIBILITY_NAMES).toEqual({
      0: 'DRAGGER_VISIBLE',
      1: 'DRAGGER_HIDDEN',
      2: 'DRAGGER_HIDDEN_COLLAPSED',
    });
  });

  it('names the FlowContainer last wrap alignments (flow_container.h:44-49)', () => {
    expect(FLOW_CONTAINER_LAST_WRAP_ALIGNMENT_NAMES).toEqual({
      0: 'LAST_WRAP_ALIGNMENT_INHERIT',
      1: 'LAST_WRAP_ALIGNMENT_BEGIN',
      2: 'LAST_WRAP_ALIGNMENT_CENTER',
      3: 'LAST_WRAP_ALIGNMENT_END',
    });
  });

  it('names the FoldableContainer title positions, POSITION_MAX left out (foldable_container.h:42-46)', () => {
    expect(FOLDABLE_CONTAINER_TITLE_POSITION_NAMES).toEqual({
      0: 'POSITION_TOP',
      1: 'POSITION_BOTTOM',
    });
  });

  it('names the GraphEdit grid patterns and panning schemes (graph_edit.h:141-149)', () => {
    expect(GRAPH_EDIT_GRID_PATTERN_NAMES).toEqual({
      0: 'GRID_PATTERN_LINES',
      1: 'GRID_PATTERN_DOTS',
    });
    expect(GRAPH_EDIT_PANNING_SCHEME_NAMES).toEqual({ 0: 'SCROLL_ZOOMS', 1: 'SCROLL_PANS' });
  });

  it('names the TextEdit line wrapping modes and caret types (text_edit.h:53-71)', () => {
    expect(TEXT_EDIT_LINE_WRAPPING_MODE_NAMES).toEqual({
      0: 'LINE_WRAPPING_NONE',
      1: 'LINE_WRAPPING_BOUNDARY',
    });
    expect(TEXT_EDIT_CARET_TYPE_NAMES).toEqual({ 0: 'CARET_TYPE_LINE', 1: 'CARET_TYPE_BLOCK' });
  });
});
