/**
 * VScrollBar strict validators: none. doc/classes/VScrollBar.xml lists only `size_flags_*`, both
 * `overrides="Control"`: the constructor (scroll_bar.h:154-155) changes defaults, and `_bind_methods`
 * (scroll_bar.cpp:714-717) binds theme items only. Control validates both with no bound
 * (control.cpp:1840-1860), and the base-walk delivers ScrollBar, Range and Control.
 */

import '../scrollbar/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('VScrollBar', {});
