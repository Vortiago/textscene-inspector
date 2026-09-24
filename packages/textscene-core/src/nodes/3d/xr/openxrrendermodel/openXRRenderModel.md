# OpenXRRenderModel engine notes

Why `linterParser.ts` registers no validator for OpenXRRenderModel. Every cite is Godot 4.6.3
source.

## The one member serialises

- `render_model` (`openxr_render_model.cpp:46`) is the class's one member. It is a
  `Variant::RID` with default usage.
- No other route adds a key. `openxr_render_model.h` declares no `_set`, `_get` or
  `get_property_list` override in either spelling, and no `ADD_ARRAY_COUNT`.
- Neither the grammar nor `SceneState::_parse_node` (`packed_scene.cpp:865`) skips an RID.
  `VariantWriter::write` (`variant_parser.cpp:2157-2163`) writes `RID(<id>)` in the ordinary
  branch, not in the unstored SIGNAL/CALLABLE bucket (`variant_parser.cpp:2165-2170`).
- So the member keeps its `RID()` default (doc/classes `default="RID()"`) in any file an editor
  saves.

## No scene can author a live value

- Only `OpenXRRenderModelManager::_update_models()` (`openxr_render_model_manager.cpp:93-96`)
  calls `set_render_model()` (`openxr_render_model.cpp:165-170`), on children it never owns.
- `_parse_node` drops an unowned node (`packed_scene.cpp:797`).
- A hand-typed `RID(5)` parses (`variant_parser.cpp:940-960`) but names an id in another
  process's `RID_Owner` table.
