/**
 * ScrollContainer strict validators for linting.
 *
 * Declares all eleven of ScrollContainer's own members (doc/classes/
 * ScrollContainer.xml minus `clip_contents`, which carries `overrides="Control"`
 * and so belongs to Control). None carries `PROPERTY_USAGE_NONE` and the class
 * overrides neither `_validate_property` nor `_get_property_list` in
 * `scroll_container.cpp`/`.h`, so every one of them serialises normally.
 *
 * `parser.ts` reads only two of these eleven, `horizontal_scroll_mode` and
 * `vertical_scroll_mode`, so the other nine (`draw_focus_border`,
 * `follow_focus`, `scroll_deadzone`, `scroll_hint_mode`, `scroll_horizontal`,
 * `scroll_horizontal_custom_step`, `scroll_vertical`,
 * `scroll_vertical_custom_step`, `tile_scroll_hint`) are validator-only: a real
 * parser gap (nothing suppresses their serialisation), not a legitimate
 * runtime-only exclusion, and out of scope for this validator-only slice to
 * fix. `propertyGrammarParity.test.ts` needs an
 * `ASYMMETRY_ALLOWLIST['ScrollContainer']` entry recording that gap; this
 * slice cannot add it (the file is out of bounds here), so it is reported
 * instead.
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

/**
 * `ScrollContainer.ScrollMode` (scroll_container.h:44-50), shared by
 * `horizontal_scroll_mode` and `vertical_scroll_mode`. Local to this slice:
 * no other registered class binds this enum.
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
  // (scroll_container.cpp:885-893) early-returns on a redundant set, then
  // assigns straight through (the reposition side effect doesn't touch the
  // value).
  draw_focus_border: v.boolean('draw_focus_border'),

  // scroll_container.cpp:847, INT, PROPERTY_HINT_NONE (only a "suffix:px"
  // hint string, no PROPERTY_HINT_RANGE). set_h_scroll (scroll_container.cpp:
  // 663-666) forwards to the internal HScrollBar's Range::set_value, whose
  // `_calc_value` (range.cpp:196-197) clamps below `shared->min` unless
  // `allow_lesser` is set. Neither ScrollContainer nor ScrollBar ever calls
  // `set_min`/`set_allow_lesser` on the internal scrollbars (constructor at
  // scroll_container.cpp:917-924 only names and parents them), and
  // `Range::Shared::min` defaults to 0.0 (range.h:40), so the floor of 0 is a
  // permanent, engine-enforced invariant, not a value this or any .tscn can
  // change. The ceiling is `max - page`, both content-derived at layout time
  // (scroll_container.cpp:595-599), so no static validator can see it:
  // floor only, per the setter actually read.
  scroll_horizontal: v.int('scroll_horizontal', { min: 0, enforced: 'range.cpp:196' }),
  // scroll_container.cpp:848, same shape; set_v_scroll (scroll_container.cpp:
  // 672-675) forwards to the internal VScrollBar the same way.
  scroll_vertical: v.int('scroll_vertical', { min: 0, enforced: 'range.cpp:196' }),

  // scroll_container.cpp:849, FLOAT, PROPERTY_HINT_RANGE "-1,4096,suffix:px"
  // (both ends closed: no `or_greater`/`or_less` token). set_horizontal_
  // custom_step (scroll_container.cpp:681-683) forwards to the internal
  // HScrollBar's `ScrollBar::set_custom_step` (scroll_bar.cpp:562-564), which
  // assigns straight through with no clamp, so both ends are warnings, not
  // errors. -1 is not an arbitrary floor: `scroll_bar.cpp:112/119/226/232/239/
  // 245` read `custom_step >= 0 ? custom_step : get_step()`, so -1 (the
  // documented default) is the legal sentinel for "use the default step",
  // not a value to floor away from.
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
  // (ScrollMode 0-4, scroll_container.h:44-50). set_horizontal_scroll_mode
  // (scroll_container.cpp:697-705) early-returns only on a redundant set and
  // otherwise assigns straight through with no ERR_FAIL_INDEX, so out of
  // range is a warning, not an error.
  horizontal_scroll_mode: v.enumInt('horizontal_scroll_mode', 0, 4, SCROLL_MODE, {
    hinted: 'scroll_container.cpp:851',
  }),
  // scroll_container.cpp:852, same enum; set_vertical_scroll_mode
  // (scroll_container.cpp:711-719) is the same shape, unconstrained.
  vertical_scroll_mode: v.enumInt('vertical_scroll_mode', 0, 4, SCROLL_MODE, {
    hinted: 'scroll_container.cpp:852',
  }),

  // scroll_container.cpp:853, INT, no hint at all (PROPERTY_HINT_NONE).
  // set_deadzone (scroll_container.cpp:729-731) assigns straight through:
  // nothing to ground, format-only.
  scroll_deadzone: v.int('scroll_deadzone'),

  // scroll_container.cpp:856, ENUM "Disabled,All,Top and Left,Bottom and Right"
  // (ScrollHintMode 0-3, scroll_container.h:52-57). set_scroll_hint_mode
  // (scroll_container.cpp:733-740) early-returns only on a redundant set and
  // otherwise assigns straight through with no ERR_FAIL_INDEX, so out of
  // range is a warning.
  scroll_hint_mode: v.enumInt('scroll_hint_mode', 0, 3, SCROLL_HINT_MODE, {
    hinted: 'scroll_container.cpp:856',
  }),
  // scroll_container.cpp:857, BOOL, no hint. set_tile_scroll_hint
  // (scroll_container.cpp:746-755) early-returns only on a redundant set and
  // otherwise assigns straight through (the stretch-mode side effect on the
  // internal hint textures doesn't touch the value).
  tile_scroll_hint: v.boolean('tile_scroll_hint'),
});
