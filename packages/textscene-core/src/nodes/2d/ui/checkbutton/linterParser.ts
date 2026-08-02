/**
 * CheckButton strict validators for linting.
 *
 * doc/classes/CheckButton.xml lists exactly two members, `alignment` and
 * `toggle_mode`, and BOTH carry `overrides="Button"` / `overrides="BaseButton"`:
 * default-value overrides, not new properties, so neither belongs here.
 * check_button.cpp's `_bind_methods` confirms it from the authority side: it
 * calls `BIND_THEME_ITEM` eleven times (theme constants/icons/colors, already
 * covered centrally by `THEME_OVERRIDE_VALIDATORS` on the Control tier) and
 * `ADD_PROPERTY` never; CheckButton::CheckButton() only calls
 * `set_toggle_mode(true)` and `set_text_alignment(HORIZONTAL_ALIGNMENT_LEFT)`,
 * which changes the inherited defaults without re-declaring the properties.
 *
 * So CheckButton binds no property of its own; it registers an empty map so
 * `getRegisteredNodeTypes()` still lists it, and everything from Button up is
 * delivered by the NODE_BASE_TYPES base-walk (see linterParser.test.ts).
 */

import '../basebutton/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('CheckButton', {});
