/**
 * GraphElement strict validators for linting.
 *
 * Declare only GraphElement's OWN members — the ones doc/classes/GraphElement.xml
 * lists without an `overrides=` attribute. Everything from Control up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * All 6 members the XML lists carry no `overrides=`, and `scene/gui/graph_element.cpp`'s
 * `ADD_PROPERTY` calls (lines 243-248) bind every one of them with no usage flag, so all
 * six reach a .tscn and all six get a validator here. None carries a `PROPERTY_HINT_RANGE`
 * or other bound, so every property is format-only — a plain Vector2 or boolean literal.
 * The one genuine cross-field concern (`selectable=false` silently forcing `selected=false`
 * at load time) is a runtime/semantic fact, not a format one — see linter.ts.
 */

import '../../../2d/ui/control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('GraphElement', {
  // scene/gui/graph_element.cpp:243 — ADD_PROPERTY(PropertyInfo(Variant::VECTOR2, "position_offset"), "set_position_offset", "get_position_offset");
  position_offset: v.vector2('position_offset'),
  // scene/gui/graph_element.cpp:244 — ADD_PROPERTY(PropertyInfo(Variant::BOOL, "resizable"), "set_resizable", "is_resizable");
  resizable: v.boolean('resizable'),
  // scene/gui/graph_element.cpp:245 — ADD_PROPERTY(PropertyInfo(Variant::BOOL, "draggable"), "set_draggable", "is_draggable");
  draggable: v.boolean('draggable'),
  // scene/gui/graph_element.cpp:246 — ADD_PROPERTY(PropertyInfo(Variant::BOOL, "selectable"), "set_selectable", "is_selectable");
  selectable: v.boolean('selectable'),
  // scene/gui/graph_element.cpp:247 — ADD_PROPERTY(PropertyInfo(Variant::BOOL, "selected"), "set_selected", "is_selected");
  selected: v.boolean('selected'),
  // scene/gui/graph_element.cpp:248 — ADD_PROPERTY(PropertyInfo(Variant::BOOL, "scaling_menus"), "set_scaling_menus", "is_scaling_menus");
  scaling_menus: v.boolean('scaling_menus'),
});
