/**
 * StatusIndicator strict validators for linting.
 *
 * Declare only StatusIndicator's OWN members — the ones doc/classes/StatusIndicator.xml
 * lists without an `overrides=` attribute. Everything from Node up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * StatusIndicator inherits plain Node, not CanvasItem or Node3D, so its own
 * `visible` (status_indicator.cpp:90) is a private bool field, not a shadow of
 * either base class's visibility property.
 */

import '../../node/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('StatusIndicator', {
  // status_indicator.cpp:87, PROPERTY_HINT_MULTILINE_TEXT — an inspector
  // widget choice, not a range. set_tooltip (:109-115) is a bare assignment.
  tooltip: v.quotedString('tooltip'),
  // status_indicator.cpp:88, PROPERTY_HINT_RESOURCE_TYPE "Texture2D".
  // set_icon (:97-103) is a bare Ref<> assignment.
  icon: v.resourceReference('icon'),
  // status_indicator.cpp:89, PROPERTY_HINT_NODE_PATH_VALID_TYPES "PopupMenu" —
  // a filter on the inspector's node picker, not on the stored value.
  // set_menu (:121-139) assigns unconditionally.
  menu: v.nodePath('menu'),
  // status_indicator.cpp:90, PROPERTY_HINT_NONE. set_visible (:145-181) has an
  // equality early-out but no range to violate — both booleans are legal.
  visible: v.boolean('visible'),
});
