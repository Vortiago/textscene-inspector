# Deprecated aliases with no row

`DEPRECATED_PROPERTY_NAMES` in `deprecatedTable.ts` has no row for these
deprecated spellings. Each is left out for the reason below.

- **The slice owns them.** `AnimationPlayer`'s three callback-mode arms and
  `AnimationTree`'s `process_callback` validate the deprecated spelling and read
  `current ?? deprecated`, so canonicalising would change which value wins.
  `deprecated.test.ts` pins each.
- **No single property receives it.** `ItemList` and `PopupMenu` read `items`
  three elements at a time into `add_item` calls (item_list.cpp:2244-2258).
- **Nothing assigns it.** `AnimationPlayer`'s `_get`-only `playback/play`
  (animation_player.cpp:71).
- **No row yet on the resource side.** `Environment.background_sky*`,
  `BaseMaterial3D`'s `flags_*`/`params_*`, `Animation.loop`,
  `NavigationMesh.polygon_verts_per_poly` and
  `VisualShaderNodeParameter.uniform_name`.
