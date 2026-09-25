/**
 * CheckButton binds no property: doc/classes/CheckButton.xml lists only `overrides=` members, and
 * check_button.cpp's `_bind_methods` calls `BIND_THEME_ITEM` but never `ADD_PROPERTY`. The empty
 * map keeps it in `registeredTypes('declaring')`, and Button's keys arrive through the
 * NODE_BASE_TYPES walk.
 */

import '../button/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('CheckButton', {});
