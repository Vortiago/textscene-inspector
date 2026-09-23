/**
 * GraphFrame strict validators: only the members doc/classes/GraphFrame.xml
 * lists without `overrides=`, since the NODE_BASE_TYPES walk delivers inherited
 * keys and a re-declared key shadows one. `mouse_filter` is a Control default
 * override, so Control's validator covers it.
 */

import '../graphelement/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

// `title`, `autoshrink_enabled`, `tint_color_enabled` and `tint_color` have no hint
// (graph_frame.cpp:192-193, 197-198), so they are format-only. The margin ranges
// (graph_frame.cpp:194-195) are closed, and their setters (graph_frame.cpp:250-258,
// graph_frame.cpp:272-274) neither fail nor clamp, so both ends warn (ADR-0032).
validatorRegistry.registerAll('GraphFrame', {
  // graph_frame.cpp:192: ADD_PROPERTY(PropertyInfo(Variant::STRING, "title"), "set_title", "get_title");
  title: v.quotedString('title'),
  // graph_frame.cpp:193: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "autoshrink_enabled"), "set_autoshrink_enabled", "is_autoshrink_enabled");
  // `resizable = true` is inert under the default `autoshrink_enabled = true` (graph_frame.cpp:74, 84, 133),
  // yet no rule flags it: the gate lives in input and draw code, not a setter or a configuration warning.
  autoshrink_enabled: v.boolean('autoshrink_enabled'),
  // graph_frame.cpp:194: PROPERTY_HINT_RANGE "0,128,1". set_autoshrink_margin (graph_frame.cpp:250) assigns unconditionally.
  autoshrink_margin: v.int('autoshrink_margin', { min: 0, max: 128, hinted: 'graph_frame.cpp:194' }),
  // graph_frame.cpp:195: PROPERTY_HINT_RANGE "0,128,1". set_drag_margin (graph_frame.cpp:272) assigns unconditionally.
  drag_margin: v.int('drag_margin', { min: 0, max: 128, hinted: 'graph_frame.cpp:195' }),
  // graph_frame.cpp:197: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "tint_color_enabled"), "set_tint_color_enabled", "is_tint_color_enabled");
  tint_color_enabled: v.boolean('tint_color_enabled'),
  // graph_frame.cpp:198: ADD_PROPERTY(PropertyInfo(Variant::COLOR, "tint_color"), "set_tint_color", "get_tint_color");
  // No rule pairs it with `tint_color_enabled`: neither setter (graph_frame.cpp:280-296) ignores a
  // write or warns, and the class overrides no `get_configuration_warnings`.
  tint_color: v.color('tint_color'),
});
