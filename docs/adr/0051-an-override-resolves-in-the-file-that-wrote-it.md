# An override resolves in the file that wrote it

- Status: Accepted
- Related: ADR-0013 (Instance root merge), the `SceneResourcesProvider` pool.

## Context

An Instance root merge (ADR-0013) builds one node from two files. The instance node's
properties and a host override of a sub-scene node (`[node name="Body" parent="Pivot"]`)
were written against the host's resource tables. The sub-scene node's own properties, and
its children, were written against the sub-scene's. Godot's loader resolves each property
in the file that holds it, against that file's own tables (`resource_format_text.cpp:103-151`), and each file numbers its
ids from its own start, so the host's `ExtResource("3")` and the sub-scene's are unrelated.

A component resolves all of a node's properties against one pool: the
`SceneResourcesContext` above it in the viewport, or a `SceneScope` in the live scene tree.
Neither one scope serves a node that two files wrote.

Two shapes were weighed:

- **(A) A scope per property.** Tag each property with the scope it resolves in. Every
  component that resolves a reference (about thirty) would read the tag instead of the
  context, and a missed one resolves silently in the wrong file.
- **(B) Re-home the override.** Copy each resource the override names, and the SubResources
  it reaches, into the node's own scope. An id the node's file already holds takes a fresh
  id, and the override's raw value is rewritten to it. The node then resolves in one scope,
  and no component changes.

## Decision

(B). `rehomeOverride` (`resources/rehomeOverride.ts`) rewrites an override's raw properties
against the scope of the node it reaches. `graftInstanceChildren` applies it to a host
override of a sub-scene node, and `mergeInstanceRoot` to the instance node's own properties.
The merged node carries the result as `LiveNode.scope` (`resources/liveNode.ts`). The viewport's
`DispatchedNode` provides it, and `scopeOf` reads it for the live scene tree, so both resolve
the node alike. A node the host adds inside the sub-scene carries the host's scope.

## Consequences

- The scope tag is render-time state of the live scene tree. The parse tree (`TscnNode`),
  which the linter reads, never carries it.
- A colliding id shows in the inspector with a suffix, for example `ExtResource("3 (outer)")`.
- An id the override names but its file lacks resolves to nothing. Godot refuses the file
  (`resource_format_text.cpp:112`, `:135-137`). The id never falls through to the
  sub-scene's resource of the same id.
