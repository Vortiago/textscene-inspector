/**
 * LightmapProbe strict validators: none. `lightmap_probe.h:35-39` has no `_bind_methods`,
 * which `initialize_class` (`object.h:526`) needs, and `lightmap_probe.cpp:33-34` is an empty
 * constructor: no PropertyListHelper, `_set`, `_get` or `_get_property_list` in either spelling.
 * `lightmap_gi.cpp:465-468` finds probes by type. `LightmapProbe.xml` has no `<members>`.
 */

import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';

// Empty, and kept: the conformance tests read the slice shape, and
// linterParser.test.ts asserts the empty own-key set against a real registration.
validatorRegistry.registerAll('LightmapProbe', {});
