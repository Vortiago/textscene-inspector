/**
 * LightmapProbe strict validators for linting: there are none, and that is a
 * finding rather than an omission.
 *
 * `lightmap_probe.h:35-39` is the entire class body: `GDCLASS(LightmapProbe,
 * Node3D)`, a `public:` label and one bare constructor declaration — no
 * `_bind_methods` override at all. `initialize_class` (`object.h:526`) only
 * calls `_bind_methods()` when a subclass's function pointer differs from its
 * parent's; LightmapProbe never redefines it, so the check is false and
 * Node3D's binding runs for it with nothing added. `lightmap_probe.cpp:33-34`
 * is the empty constructor body and nothing else: no `ADD_PROPERTY`, no
 * `ADD_ARRAY_COUNT`, no `PropertyListHelper`/`register_property`, and no
 * hand-rolled `_set`/`_get`/`_get_property_list` (checked both spellings — no
 * unprefixed `get_property_list` either, the shape `ChainIK3D` uses). Its only
 * other reference in the engine, `lightmap_gi.cpp:465-468`, is
 * `Object::cast_to<LightmapProbe>`, which finds probe nodes by type, followed
 * by `probe->get_global_transform()` — Node3D's own method, not anything
 * LightmapProbe declares. `LightmapProbe.xml` carries no `<members>` block,
 * which agrees: the class exists to be found by its type, not to carry state.
 *
 * Everything a `.tscn` may write on a LightmapProbe therefore belongs to Node3D
 * (transform, visibility, rotation order, …) and Node above it, delivered by the
 * NODE_BASE_TYPES base-walk. Re-declaring any of it here would shadow the
 * ancestor's validator with a duplicate that then drifts from it, so the
 * registration below stays empty. The call itself is kept because the slice
 * shape is what the conformance tests read, and because `linterParser.test.ts`
 * asserts the empty own-key set against a registration that really happened.
 */

import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('LightmapProbe', {});
