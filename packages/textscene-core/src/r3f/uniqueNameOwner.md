# Unique-name tables per owner

`uniqueNameOwner.ts` gives each instance root a `%Name` table of its own. This follows Godot 4.6.3:

- `_acquire_unique_name_in_owner` registers a name on the node's owner (`node.cpp:2222-2234`).
- `get_node` reads the caller's own table, else its owner's (`node.cpp:1930-1938`).
- So each instance root has a table of its own, which an outer consumer never sees.
