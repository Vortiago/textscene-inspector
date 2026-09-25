/**
 * GraphElement strict validators: only the members doc/classes/GraphElement.xml
 * lists without `overrides=`, since the NODE_BASE_TYPES walk delivers Control's and
 * a re-declared key shadows it. None has a bound in scene/gui/graph_element.cpp, so
 * each is format-only; linter.ts holds the selectable/selected rule.
 */

import '../../../2d/ui/control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('GraphElement', {
  // scene/gui/graph_element.cpp:243: ADD_PROPERTY(PropertyInfo(Variant::VECTOR2, "position_offset"), "set_position_offset", "get_position_offset");
  position_offset: v.vector2('position_offset'),
  // scene/gui/graph_element.cpp:244: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "resizable"), "set_resizable", "is_resizable");
  resizable: v.boolean('resizable'),
  // scene/gui/graph_element.cpp:245: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "draggable"), "set_draggable", "is_draggable");
  draggable: v.boolean('draggable'),
  // scene/gui/graph_element.cpp:246: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "selectable"), "set_selectable", "is_selectable");
  selectable: v.boolean('selectable'),
  // scene/gui/graph_element.cpp:247: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "selected"), "set_selected", "is_selected");
  selected: v.boolean('selected'),
  // scene/gui/graph_element.cpp:248: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "scaling_menus"), "set_scaling_menus", "is_scaling_menus");
  scaling_menus: v.boolean('scaling_menus'),
});
