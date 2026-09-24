# OpenXRCompositionLayer engine notes

Why `linterParser.ts` validates `layer_viewport` as a NodePath or `null`. Every cite is Godot 4.6.3
source.

- `layer_viewport` is declared at `openxr_composition_layer.cpp:151` as OBJECT with
  `PROPERTY_HINT_NODE_TYPE "SubViewport"`.
- `PackedScene::_parse_node` (`packed_scene.cpp:884-891`) writes this OBJECT + NODE_TYPE slot as a
  NodePath, and omits it when it is cleared.
- Whether the target is a SubViewport is a semantic rule's concern, since it needs the tree.
- A bare `null` loads. `variant_parser.cpp:699` reads it, and NIL converts to OBJECT
  (`variant.cpp:543-545`).
- Both `set_layer_viewport` guards read `p_viewport != nullptr`
  (`openxr_composition_layer.cpp:295-305`), and the engine passes nullptr itself at `:345`.
