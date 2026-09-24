/**
 * HSeparator strict validators: none. `doc/classes/HSeparator.xml` has no members, and the
 * constructor (separator.cpp:71-73) only sets the protected `orientation` field (separator.h:43),
 * which `Separator` never exposes through `ADD_PROPERTY`. It imports Control directly: Separator
 * registers nothing, and NODE_BASE_TYPES resolves `HSeparator -> Separator -> Control` by table.
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('HSeparator', {});
