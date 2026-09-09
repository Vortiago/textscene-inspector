/**
 * OpenXRRenderModel strict validators for linting.
 *
 * OpenXRRenderModel's only own member is `render_model`
 * (openxr_render_model.cpp:46): `ADD_PROPERTY(PropertyInfo(Variant::RID,
 * "render_model"), "set_render_model", "get_render_model");` — no hint, so
 * default usage (PROPERTY_USAGE_STORAGE | PROPERTY_USAGE_EDITOR). No other
 * route applies: openxr_render_model.h declares no `_set`/`_get`/
 * `get_property_list` override under either spelling and no
 * `ADD_ARRAY_COUNT`.
 *
 * Whether it can appear in a `.tscn` at all comes down to what an RID IS, not
 * just the grammar. `VariantWriter::write` (variant_parser.cpp:2157-2163)
 * puts `Variant::RID` in the ordinary "Misc types" branch and writes
 * `RID(<id>)` for a non-default value — it is NOT in the "do not really
 * store these" bucket immediately below it, reserved for SIGNAL/CALLABLE
 * (variant_parser.cpp:2165-2170). So the grammar alone does not forbid it,
 * and `PROPERTY_USAGE_STORAGE` means `SceneState::_parse_node`
 * (packed_scene.cpp:865) does not skip it either.
 *
 * What forbids it in practice: `render_model` only ever becomes non-null
 * through `set_render_model()` (openxr_render_model.cpp:165-170), called
 * exclusively by `OpenXRRenderModelManager::_update_models()`
 * (openxr_render_model_manager.cpp:93-96) with an RID the OpenXR runtime
 * issues at that instant. Those `OpenXRRenderModel` children are `memnew`'d
 * and `add_child`'d there without ever calling `set_owner()`, and
 * `SceneState::_parse_node`'s very first line — "discard nodes that do not
 * belong to be processed" — drops any node whose owner is not the packed
 * scene's owner (packed_scene.cpp:797) — so these children never reach a
 * saved `.tscn` at all, regardless of what their RID holds.
 *
 * A hand-authored, properly-owned OpenXRRenderModel node could still exist in
 * an editor scene, but the property has no editor widget and no legitimate
 * assignment path outside the manager, so it keeps its `RID()` default
 * (doc/classes default="RID()") — and only a value that differs from default
 * is ever written. Typing `render_model = RID(5)` in by hand is syntactically
 * legal (the parser reads it back, variant_parser.cpp:940-960) but names an
 * id into a different process's live `RID_Owner` table, meaningless on
 * reload.
 *
 * OpenXRRenderModel therefore owns zero validatable properties.
 */

import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('OpenXRRenderModel', {});
