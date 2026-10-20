# Which property-list keys get a row

A key gets a row in `ROWS` only when it carries the storage bit, because `SceneState::save` skips
a key without it (`packed_scene.cpp:865-867`). `MultiplayerSpawner`'s `scenes/<i>/…` keys carry no
storage bit (`multiplayer_spawner.cpp:72,83`), so it has no row.

The usage flags decide the bit:

- `PROPERTY_USAGE_NO_EDITOR` is `STORAGE` alone (`object.h:132`), so its key is serialised.
- `PROPERTY_USAGE_DEFAULT` is `STORAGE | EDITOR` (`object.h:131`), and it applies when a
  `PropertyInfo` gives no usage argument.
- Only an explicit usage list without the storage bit excludes a key.
- One property-list function can mix both shapes, so read the usage of each key.
