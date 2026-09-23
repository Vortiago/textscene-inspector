# Instance root merge collapses the single-root sub-scene wrapper

When a Node instances a single-root `.tscn`, the redundant wrapper level collapses so that the instance Node *becomes* the sub-scene root. It adopts the `type` and `children` of the root, with the instance's own properties merged over the root's. That matches the scene tree of the Godot editor and its UX for reaching internals. The wrapper level had no UX value (every interior selection cost an extra expand), and the instance node had no real type of its own.

## Considered options

- **Merge at parse/build time in `buildSceneGraph()`.** Rejected. Instanced sub-scenes load lazily through the resource event bus (`useResource`), so at build time `buildSceneGraph()` has no sub-scene to merge. The merge happens at render time.

## Decision

`collapseLiveNode` (`r3f/liveSceneTree.ts`) is the one definition of the merge. The viewport (`InstancedNode` in `NodeDispatcher`), the tree (`TreeNode` / `useSubSceneChildren`) and the inspector all call it, so they agree on node paths.

The inspector (`NodeDetailsPanel`) resolves a selection through a `useLiveNode(path)` hook (beside `useLiveSceneNodes`). The hook resolves through `resolveLiveEntry`: the `resolveLiveNode` walk plus the **originating** `instanceRef` of the selected node. It subscribes to `useLiveTreeVersion`, so a selection inside a sub-scene that has not loaded yet updates when the sub-scene arrives. The originating ref matters because the merged node's own `instance` is the one of the sub-scene root (cleared for a plain root). The 📦 external-scene indicator of the inspector, like the badge of the tree, keys off the originating ref, not the collapsed node.

## Consequences

- **Transform is replaced, not composed.** The `transform` of the instance overrides the root's (`{...root.properties, ...instance.properties}`), as in Godot. The nested form composed `T_instance × T_root` silently, a double transform for any sub-scene whose root has a non-identity transform.
- **Path consistency is load-bearing for ADR-0012.** The collapse drops the synthetic root segment, so the selection path of an instanced AnimationPlayer is `…/Coin1/Animation` (not `…/Coin1/Coin/Animation`). The tree, the viewport and the inspector must drop the wrapper together. Otherwise `selectedNodePath` stops matching the `useNodePath()` of the player, and the selection-driven Animation tab breaks for instanced players. The shared `collapseLiveNode` keeps them together.
- **Fallbacks keep the nested form.** `.glb` instances (synthetic `GLBSceneRoot`) and scenes with several top-level nodes are *not* merged. They stay injected as children under a nested resources provider, which keeps the GLB property-override-by-name channel.
- The merged row keeps the instance ref, so it still shows the 📦 badge and the ⤢ open-standalone affordance. Recursion is bounded: the rendered children are the plain children of the root, which carry no instance ref of their own (nested instances merge on their own turn).
- **`SceneResourcesProvider` inherits the ambient pool** (own resources first, parent as fallback). The collapse dispatches the merged node again under the resource pool of the sub-scene. Children that the **host** added under the instance node (for example host-scene child instances under a sub-scene instance) would otherwise lose access to their host `ExtResource` ids and fail to load silently. Inheritance restores host-scoped resolution, while the own-scene ids of a node still win on a collision.
