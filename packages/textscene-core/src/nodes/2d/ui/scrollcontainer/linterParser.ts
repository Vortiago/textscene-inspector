/**
 * ScrollContainer's strict validators: its own members in doc/classes/
 * ScrollContainer.xml, less `clip_contents` (`overrides="Control"`). None is
 * `PROPERTY_USAGE_NONE`, and `scroll_container.cpp` narrows none, so all serialise.
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

/**
 * `ScrollContainer.ScrollMode` (scroll_container.h:44-50), for
 * `horizontal_scroll_mode` and `vertical_scroll_mode`. No other class binds it.
 */
const SCROLL_MODE = {
  0: 'DISABLED',
  1: 'AUTO',
  2: 'SHOW_ALWAYS',
  3: 'SHOW_NEVER',
  4: 'RESERVE',
} as const;

/**
 * `ScrollContainer.ScrollHintMode` (scroll_container.h:52-57), used only by
 * `scroll_hint_mode`.
 */
const SCROLL_HINT_MODE = {
  0: 'DISABLED',
  1: 'ALL',
  2: 'TOP_AND_LEFT',
  3: 'BOTTOM_AND_RIGHT',
} as const;

validatorRegistry.registerAll('ScrollContainer', {
  // scroll_container.cpp:843, BOOL, no hint. set_follow_focus
  // (scroll_container.cpp:765-767) assigns straight through.
  follow_focus: v.boolean('follow_focus'),
  // scroll_container.cpp:844, BOOL, no hint. set_draw_focus_border
  // (scroll_container.cpp:885-893) assigns straight through.
  draw_focus_border: v.boolean('draw_focus_border'),

  // scroll_container.cpp:847, INT, PROPERTY_HINT_NONE. set_h_scroll (scroll_container.cpp:
  // 663-666) reaches the internal bar's `_calc_value` (range.cpp:196-197), which
  // clamps below min. That min stays 0.0 (range.h:40): scroll_container.cpp:917-924
  // never sets it. The ceiling comes from layout (scroll_container.cpp:595-599).
  scroll_horizontal: v.int('scroll_horizontal', { min: 0, enforced: 'range.cpp:196' }),
  // scroll_container.cpp:848, same shape; set_v_scroll (scroll_container.cpp:
  // 672-675) forwards to the internal VScrollBar the same way.
  scroll_vertical: v.int('scroll_vertical', { min: 0, enforced: 'range.cpp:196' }),

  // scroll_container.cpp:849 hints "-1,4096,suffix:px", both ends closed. The
  // setter (scroll_container.cpp:681-683) reaches scroll_bar.cpp:562-564, which
  // assigns straight through, so both ends warn. -1 means "use the default
  // step": `scroll_bar.cpp:112/119/226/232/239/245` read `custom_step >= 0 ? …`.
  scroll_horizontal_custom_step: v.float('scroll_horizontal_custom_step', {
    min: -1,
    max: 4096,
    hinted: 'scroll_container.cpp:849',
  }),
  // scroll_container.cpp:850, same shape; set_vertical_custom_step
  // (scroll_container.cpp:689-691) forwards to the internal VScrollBar the
  // same way.
  scroll_vertical_custom_step: v.float('scroll_vertical_custom_step', {
    min: -1,
    max: 4096,
    hinted: 'scroll_container.cpp:850',
  }),

  // scroll_container.cpp:851, ENUM "Disabled,Auto,Always Show,Never Show,Reserve"
  // (scroll_container.h:44-50). set_horizontal_scroll_mode (scroll_container.cpp:697-705)
  // has no ERR_FAIL_INDEX, so out of range is a warning.
  horizontal_scroll_mode: v.enumInt('horizontal_scroll_mode', 0, 4, SCROLL_MODE, {
    hinted: 'scroll_container.cpp:851',
  }),
  // scroll_container.cpp:852, same enum; set_vertical_scroll_mode
  // (scroll_container.cpp:711-719) is the same shape, unconstrained.
  vertical_scroll_mode: v.enumInt('vertical_scroll_mode', 0, 4, SCROLL_MODE, {
    hinted: 'scroll_container.cpp:852',
  }),

  // scroll_container.cpp:853, INT, PROPERTY_HINT_NONE. set_deadzone
  // (scroll_container.cpp:729-731) assigns straight through. Format-only.
  scroll_deadzone: v.int('scroll_deadzone'),

  // scroll_container.cpp:856, ENUM "Disabled,All,Top and Left,Bottom and Right"
  // (scroll_container.h:52-57). set_scroll_hint_mode (scroll_container.cpp:733-740)
  // has no ERR_FAIL_INDEX, so out of range is a warning.
  scroll_hint_mode: v.enumInt('scroll_hint_mode', 0, 3, SCROLL_HINT_MODE, {
    hinted: 'scroll_container.cpp:856',
  }),
  // scroll_container.cpp:857, BOOL, no hint. set_tile_scroll_hint
  // (scroll_container.cpp:746-755) assigns straight through.
  tile_scroll_hint: v.boolean('tile_scroll_hint'),
});
