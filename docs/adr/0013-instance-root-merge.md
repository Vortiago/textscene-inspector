# Instance root merge collapses the single-root sub-scene wrapper

When a Node instances a single-root `.tscn`, we collapse the redundant wrapper level so the instance Node *becomes* the sub-scene root (adopting its `type` and `children`, with the instance's own properties merged over the root's), matching the Godot editor's scene tree and reaching-internals UX. We chose this over keeping the extra nesting level because the wrapper had no UX value (every interior selection cost an extra expand) and because the instance node carried no real type of its own.

## Considered options

- **Merge at parse/build time in `buildSceneGraph()` (single place).** Rejected: instanced sub-scenes load lazily through the resource event bus (`useResource`), so at build time `buildSceneGraph()` has no sub-scene to merge. The merge must therefore happen at render time, applied **identically in both independent resolution paths** — the tree (`useSubSceneChildren` / `TreeNode`, and the sibling `resolveNodeByPath`) and the viewport (`NodeDispatcher` / `InstancedSceneSubtree`). They resolve instances separately and must agree on node paths.

## Consequences

- **Transform is replaced, not composed.** The instance's `transform` overrides the root's (`{...root.properties, ...instance.properties}`), as in Godot — where today's nested form silently composed `T_instance × T_root`. This fixes a latent double-transform for any sub-scene whose root has a non-identity transform; expect visual-regression baseline updates for affected scenes.
- **Path consistency is load-bearing for ADR-0012.** Collapsing drops the synthetic root segment, so an instanced AnimationPlayer's selection path becomes `…/Coin1/Animation` (not `…/Coin1/Coin/Animation`). The tree, the dispatcher, and `resolveNodeByPath` must change together; if only one drops the wrapper, `selectedNodePath` stops matching the player's `useNodePath()` and the selection-driven Animation tab breaks for instanced players.
- **Fallbacks keep the nested form.** `.glb` instances (synthetic `GLBSceneRoot`) and any scene with multiple top-level nodes are *not* merged — they stay injected as children under a nested resources provider, preserving the GLB property-override-by-name channel.
- The merged row keeps the instance ref so it still shows the 📦 badge and ⤢ open-standalone affordance; recursion is naturally bounded because the rendered children are the root's plain children, which carry no instance ref of their own (nested instances merge on their own turn).
- **`SceneResourcesProvider` now inherits the ambient pool** (own resources first, parent as fallback). Collapsing re-dispatches the merged node under the sub-scene's resource pool, so children the HOST added under the instance node (e.g. host scene child instances parented under a sub-scene instance) would otherwise lose access to their host `ExtResource` ids and silently fail to load. Inheritance restores host-scoped resolution while a node's own-scene ids still win on any (vanishingly rare) collision.

## Amendment (2026-06-19): merge logic consolidated into one shared function

The "Considered options" note framed the merge as necessarily applied across **two independent
resolution paths** (tree vs viewport) that resolve instances separately and must agree on node paths.
That duplication has since been removed: `collapseLiveNode` (`r3f/liveSceneTree.ts`) is now the single
definition, called by the viewport (`NodeDispatcher`'s `InstancedNode`), the tree (`TreeNode` /
`useSubSceneChildren`), and the inspector resolver (`resolveNodeByPath`, a thin adapter over the shared
`resolveLiveNode`). The decision is unchanged — collapse the single-root wrapper, **replace** (not
compose) the transform, inherit the resource pool — but the "two paths that must agree" risk is gone:
there is now one path. (The viewport merge site is `InstancedNode`; the `InstancedSceneSubtree` named in
the original draft was never the rendered component.)

## Amendment (2026-06-30): inspector reads `resolveLiveNode` directly; the forwarder is gone

The 2026-06-19 amendment claimed "there is now one path", but the `NodeDetailsPanel` still kept a
second one: it resolved selections via a `SceneGraph.flattenedNodes.find` fast-path (falling back to a
`SceneTreeViewer/resolveNodeByPath` forwarder), so an instance **root** showed the *uncollapsed* wrapper
type, and a selection inside a not-yet-loaded sub-scene stuck on the placeholder forever (the panel's
memo carried no live-tree version tick). That panel is now routed through a `useLiveNode(path)` hook
(beside `useLiveSceneNodes`) which resolves through `resolveLiveEntry` (the `resolveLiveNode` walk plus
the selected node's ORIGINATING `instanceRef`) and subscribes to `useLiveTreeVersion`. The originating
ref matters because the merged node's own `instance` is the sub-scene root's (cleared for a plain root),
so the inspector's 📦 external-scene indicator — like the tree's badge — keys off the originating ref,
not the collapsed node. The `resolveNodeByPath` forwarder is removed; its tests are rehomed onto
`resolveLiveNode`. The inspector now genuinely shares the single collapse/resolve path with the tree and
viewport (issue #176).
