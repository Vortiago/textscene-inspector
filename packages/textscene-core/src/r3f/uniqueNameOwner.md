# Unique-name tables per owner

`uniqueNameOwner.ts` gives each instance root a `%Name` table of its own. This follows Godot 4.6.3:

- `_acquire_unique_name_in_owner` registers a name on the node's owner (`node.cpp:2222-2234`).
- `get_node` reads the caller's own table, else its owner's (`node.cpp:1930-1938`).
- So each instance root has a table of its own, which an outer consumer never sees.
- An inherited root is its base's instance (`packed_scene.cpp:227-231`), so it owns the base's nodes and their names too.

The collapse composes each instance's table in file order (`resources/instanceNameTable.ts`), because a heading's `parent=` reads the table as of that heading. `uniqueNameOwner.ts` reads the composed table off the merged node and does not compose one of its own.

An explicit `owner=` names a node from the root of the file the heading is in. Instantiate walks it from that root with `get_node_or_null` when it sets the owner (`packed_scene.cpp:159-161`, `:565-568`), so a `%Name` in it reads the tables as of that heading. The seating resolves the part its own headings answer (`resolvedOwner` in `parser/sceneTreeBuilder.ts`). The instance graft resolves the rest, inside the instance, through its own table. `claimOwnerOf` reads that rest through the instance's composed table, which holds the same claims.
