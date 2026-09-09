/**
 * VSeparator strict validators for linting.
 *
 * `doc/classes/VSeparator.xml` lists no `<members>` at all, and its
 * constructor (separator.cpp:75-77) does nothing but set the protected
 * `orientation` field (separator.h:43) to `VERTICAL`. That field is never
 * exposed through `ADD_PROPERTY` on `Separator` either (see
 * `../separator/linterParser.ts`), so it is not a serialisable property to
 * validate. VSeparator therefore registers nothing of its own.
 *
 * Imports Control directly rather than through `../separator/linterParser.js`:
 * Separator registers nothing, so routing through it would add an empty hop
 * for no reason. Every key VSeparator accepts (Control, CanvasItem, Node, and
 * the `theme_override_*` wildcards Control declares generically) arrives
 * through the NODE_BASE_TYPES base-walk regardless of which module is
 * imported here, since that walk resolves `VSeparator -> Separator -> Control`
 * by table lookup, not by import graph.
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('VSeparator', {});
