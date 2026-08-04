/**
 * GraphFrame strict validators for linting.
 *
 * Declare only GraphFrame's OWN members: the ones doc/classes/GraphFrame.xml
 * lists without an `overrides=` attribute. Everything from GraphElement up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * `mouse_filter` carries `overrides="Control"` in the XML (a default-value
 * override of a Control property, not a new member), so it is skipped here
 * and reaches GraphFrame through Control's own validator.
 *
 * `autoshrink_margin` and `drag_margin` each hint a closed `PROPERTY_HINT_RANGE`
 * (graph_frame.cpp:194-195) with no `or_greater`/`or_less` suffix, and both
 * setters (graph_frame.cpp:250-258, graph_frame.cpp:272-274) assign straight
 * through with no `ERR_FAIL` or clamp, so both ends of both bounds are
 * warnings, not errors (ADR-0032).
 *
 * `title`, `autoshrink_enabled`, `tint_color_enabled` and `tint_color` carry no
 * hint at all (graph_frame.cpp:192-193, 197-198), so they are format-only.
 *
 * Two candidate cross-field checks were considered and rejected for linter.ts.
 * `tint_color_enabled`/`tint_color`: `tint_color` only visibly tints the frame
 * while `tint_color_enabled` is true, but neither setter (graph_frame.cpp:280-296)
 * ignores a write or warns, and the class has no `get_configuration_warnings`
 * override, so authoring one without the other is legal Godot, not a defect.
 * `resizable`/`autoshrink_enabled`: gui_input, get_cursor_shape and the
 * NOTIFICATION_DRAW branch (graph_frame.cpp:74, 84, 133) all gate the resize
 * handle on `resizable && !autoshrink_enabled`, so `resizable = true` is inert
 * under the default `autoshrink_enabled = true`. Still no `linter.ts` case:
 * `resizable` belongs to GraphElement, whose own `set_resizable` does not
 * ignore the write either, and the gate lives in interaction/draw code, not a
 * setter or a configuration warning.
 */

import '../graphelement/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('GraphFrame', {
  // graph_frame.cpp:192: ADD_PROPERTY(PropertyInfo(Variant::STRING, "title"), "set_title", "get_title");
  title: v.quotedString('title'),
  // graph_frame.cpp:193: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "autoshrink_enabled"), "set_autoshrink_enabled", "is_autoshrink_enabled");
  autoshrink_enabled: v.boolean('autoshrink_enabled'),
  // graph_frame.cpp:194: PROPERTY_HINT_RANGE "0,128,1". set_autoshrink_margin (graph_frame.cpp:250) assigns unconditionally.
  autoshrink_margin: v.int('autoshrink_margin', { min: 0, max: 128, hinted: 'graph_frame.cpp:194' }),
  // graph_frame.cpp:195: PROPERTY_HINT_RANGE "0,128,1". set_drag_margin (graph_frame.cpp:272) assigns unconditionally.
  drag_margin: v.int('drag_margin', { min: 0, max: 128, hinted: 'graph_frame.cpp:195' }),
  // graph_frame.cpp:197: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "tint_color_enabled"), "set_tint_color_enabled", "is_tint_color_enabled");
  tint_color_enabled: v.boolean('tint_color_enabled'),
  // graph_frame.cpp:198: ADD_PROPERTY(PropertyInfo(Variant::COLOR, "tint_color"), "set_tint_color", "get_tint_color");
  tint_color: v.color('tint_color'),
});
