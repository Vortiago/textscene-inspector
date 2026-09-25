# AnimationPlayer drives sibling objects through a THREE.AnimationMixer rooted at root_node

- Status: Accepted. Name binding amended by the exact-binding amendment (below).

Every other node component renders only itself (the "each component renders itself" invariant, with non-visual types as transform-only groups per ADR-0005 and ADR-0008). An AnimationPlayer animates *other* nodes, named by `NodePath("Child:property")` tracks. A `THREE.AnimationMixer` built on the player's **Animation root** (`root_node`, default `..`, the parent of the player) drives them. It binds `THREE.KeyframeTrack`s by name-path (`"Mesh.position"`). `THREE.PropertyBinding` resolves each target by a search of the subtree. It finds the named, transform-bearing object through the unnamed pickable wrappers of the dispatcher, so the mixer overrides the base transform of that object while it plays. `useFrame` advances the mixer, gated by the scene-level **Animation transport**. The transport starts stopped on load, showing the authored pose, until the user presses play.

Rejected: a central animation-value context that computes per-frame values and pushes them into every animatable component. The mixer keeps *all* animation logic inside the AnimationPlayer slice, and every target component (sprite2d, meshinstance3d, the Node2D/Node3D bases, …) stays untouched. The cost is three dependencies. The name-based binding of three.js must resolve through the wrapper nesting of the dispatcher (a test pins it). Target names must be unique within the subtree of `root_node`. Tracks must not reach above it.

## Consequences

- The slice supports `value` tracks for `position`/`rotation`/`rotation_degrees`/`scale` over any NodePath that resolves at or below the animation root, at any depth. The `bezier`, `method`, `audio` and `animation` track types are deferred.
- **Track names carry the target name alone, never the path.** `PropertyBinding` reads only the final segment and searches the whole subtree of the mixer root, so the ancestors in the path add nothing. The cost is name-based binding: `A/Target` and `Wrong/Target` are indistinguishable, and a duplicated name binds to whichever THREE finds first. Exact binding through `clipAction(clip, targetObject)` would remove that class of ambiguity. It is proposed, not built.
- **A track that resolves above the animation root is dropped with a warning.** `PropertyBinding` never leaves the subtree of the mixer root. A literal `..` in a track name is outside its grammar and throws while the action is built. Rejected: raising the mixer root to reach such a target. It re-points every `NodePath(".")` track in the player at the raised ancestor, and widens the name search for tracks that never needed it. Exact binding through `clipAction` is the route to `..` support.
- **One `resolveTrackBinding` decides both the track names of the clip and `resolveTrackTarget`.** It applies Godot's rule that `..` cancels the previous segment, so `Sprite/..` is the root and `A/../B` is `B`. The two must agree. A target that `resolveTrackTarget` misses is still driven by the mixer but loses the YXZ Euler reorder and the base-transform snapshot. A multi-axis rotation then composes in the Euler order of THREE, and the target stays displaced after stop.
- **Rotation fidelity:** rotation drives per-component `.rotation[x|y|z]` (NumberKeyframeTrack), not a whole-`.rotation` VectorKeyframeTrack. A whole-Euler write bypasses the onChange of Euler and leaves `.quaternion` (which builds the matrix) stale, so nothing rotates. Per-component lerp also matches Godot and supports a full turn beyond 180°. Targets are reordered to Godot's `YXZ` Euler order so multi-axis rotations compose identically. `loop_mode` 2 maps to `LoopPingPong`.
- AnimationPlayer is a *transform-only group that is also an animation driver*: invisible but not inert.
- Playback is non-deterministic over time, so playback fixtures stay out of the visual-regression manifest (like Label3D). The default (stopped) render stays byte-stable.

> **Amendment (exact binding):** a Track binds the node its NodePath names, not a name found in a
> subtree. These parts above no longer hold: the mixer rooted at `root_node` in the title, the
> name-path binding in the first two paragraphs, "at or below the animation root" in the first
> bullet, and the three bullets on name-only Track names, on dropping a `..` Track and on
> `resolveTrackBinding`. Now:
>
> - `resolveAnimationRootPath` resolves `root_node` from the player's own path, and each Track
>   resolves from that root, both with Godot's `get_node` walk (`resolveRelativePath`). A clip
>   template names each Track by its target's scene path (`Root/Right/Arm.position`). A path that
>   climbs above the scene root reaches nothing, and the player drops it with a warning. A `..`
>   sibling of the Animation root binds like any other node, and the root does not move.
> - The walk follows `_update_caches` (`animation_mixer.cpp:661-666`, `:689`, `:714`). An empty
>   `root_node` reaches nothing, so the player drives nothing (`node.cpp:1894`). An absolute path
>   measures from the SceneTree root, which a preview has no counterpart for, so it reaches
>   nothing. A `%Name` segment reads the owner's unique-name table, the player's for `root_node`
>   and the Animation root's for a Track. A Track with `enabled = false` is skipped.
> - Each driver calls `bind()` when it builds a mixer, the player's own or an AnimationTree's
>   (ADR-0019). So `bind()` finds a target that loaded late. `trackTargets.ts` finds the object the
>   dispatcher registered at that path: the named group inside its wrapper. It reaches content that
>   no path registers, such as a glTF scene, from the longest registered prefix, one name for each
>   remaining segment. That walk never enters another node's wrapper. `bind()` renames the Track
>   to the object's uuid, which `PropertyBinding.findNode` matches exactly. A path with no target
>   warns and binds nothing, so `Left/Arm` and `Right/Arm` never collide and `Nope/Arm` moves
>   nothing.
> - The mixer roots on the scene the player hangs in. A node can escape its parent's three group
>   (ADR-0008), so only the scene is an ancestor of every target.
> - The driver entry carries `bind()`, which returns the bound clips and the objects they move.
>   Every driver snapshots exactly those objects. The YXZ Euler reorder happens in `bind`, so an
>   AnimationTree that plays an unselected player's clips gets it too.
> - Rejected: one action per target through `clipAction(clip, target)`. One animation would
>   become several actions, which the transport, `usePlaybackLoop` and an AnimationTree blend
>   would all have to start, seek and weight together. The uuid keeps one clip per animation.
