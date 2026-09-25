/**
 * VSeparator strict validators: none of its own. `doc/classes/VSeparator.xml` lists no
 * `<members>`, and the constructor (separator.cpp:75-77) only sets the protected `orientation`
 * field (separator.h:43) to `VERTICAL`, which `Separator` never exposes through `ADD_PROPERTY`
 * (see `../separator/linterParser.ts`).
 */

// Control directly, not through Separator, which registers nothing. The NODE_BASE_TYPES
// base-walk resolves `VSeparator -> Separator -> Control` by table lookup, not by import graph,
// so every Control, CanvasItem, Node and `theme_override_*` key arrives either way.
import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('VSeparator', {});
