# A sub-viewport is a canvas boundary, not a world boundary

- Status: Accepted (2026-07-29)
- Related: ADR-0003 (2D-UI DOM overlay), ADR-0006 (viewport-mode seam and its two
  amendments), ADR-0024 (DOM-overlay browser gate), ADR-0002 (three separate registries).

## Context

`SubViewport` and `SubViewportContainer` appear across the vendored corpus — 15 nodes in
9 committed demo scenes, including the whole `demos/viewport/` family, plus
`godot-open-rts`' `IconRenderBooth.tscn` and `Match.tscn` — and rendered as unknown nodes.

Issue #133 framed the decision as a three-way choice: render-to-texture, inline composite,
or a sized placeholder. **All three are wrong**, because each assumes a sub-viewport
behaves one way. Seven reference renders through real Godot 4.6.3 (`pnpm ref:godot`,
editor previews injected) say the behaviour splits by *content kind*:

| Probe | Result |
| --- | --- |
| `MeshInstance3D` inside a SubViewport, `own_world_3d` unset | **Renders in the parent 3D view**, transform composing as through a plain `Node` |
| same, `own_world_3d = true` | Not rendered |
| same, `disable_3d = true` | **Still rendered** — `disable_3d` does not affect the parent view |
| `ColorRect` inside a SubViewport, sibling `ColorRect` outside | Outside draws; **inside does not** |
| `viewport/2d_in_3d`, `gui_in_3d`, `3d_in_2d` | Content appears **only** on the ViewportTexture'd surface |

Godot's source says why. `Viewport::Viewport()` always instantiates `world_2d`, so
`find_world_2d` (viewport.cpp:1249) returns its own and never walks up. But
`find_world_3d` (viewport.cpp:4486) falls through to `parent->find_world_3d()` unless
`own_world_3d` is set. The asymmetry is a property of `Viewport` itself, not of
`SubViewport`. Corroboration: `_propagate_drag_notification` (viewport.cpp:1260) skips
"a SubViewport that is not a child of a SubViewportContainer" — Godot's own code treats
the container as *the* composed case.

## Decision

**A sub-viewport always owns its World2D and shares its parent's World3D.** Its CanvasItem
descendants — 2D world *and* Control UI — draw nowhere in the parent; its Node3D
descendants draw exactly as through a plain `Node` unless `own_world_3d`. Its target is
displayed by a **viewport surface**: a `SubViewportContainer`, or a `ViewportTexture`
consumer.

**The registration carries the rule, not new dispatcher branches.** `SubViewport`
registers with neither `canvasItem` nor `container`, so `PlainNode`'s existing workspace
rules pass it through in the 3D workspace and drop its subtree in the 2D one — exactly the
measured asymmetry, with no edit to `NodeDispatcher`. The slice owns only the
`own_world_3d` gate. `disable_3d` is deliberately not consulted.

**`ControlDispatcher` stops at the boundary.** This fixed a live defect: `SubViewport` was
unregistered in the Control registry, so `GenericControlFallback`'s `display: contents`
rendered its subtree straight into the parent HUD. `Match.tscn`'s `MinimapViewport` and
fog-of-war `ColorRect`s were bleeding into the on-screen HUD.

**A viewport surface is the one exception to the 3D-workspace drop.** `SubViewportContainer`
is a Control, so it belongs in `TWO_D_UI_TYPES` — that set mirrors the Control registry and
drives the 2D-content hint and the root-workspace rule. But dropping its *subtree* in the
3D workspace would take a contained sub-viewport's 3D content with it, and Godot draws that
content. So the two questions `TWO_D_UI_TYPES` used to answer at once — "is this 2D UI" and
"does the 3D canvas skip its subtree" — diverge here for the first time, and the dispatcher
subtracts `VIEWPORT_SURFACE_TYPES`.

**Surface geometry, measured** (300×200 container at (100,80), 200×150 sub-viewport):

| `stretch` | Drawn rect | Content laid out against |
| --- | --- | --- |
| `false` (default) | **200×150** at the container's top-left — the *viewport's* size | `SubViewport.size` |
| `true` | **300×200** — the container's own rect | `get_size() / stretch_shrink` |

`SubViewportContainer::_notification(NOTIFICATION_DRAW)` loops **every** SubViewport child
and draws each, stacked in tree order — not just the first. Clipping is a *consequence*,
not an operation: the container issues no clip, but the target is only `size` pixels, so
content beyond it was never rendered. The DOM equivalent puts `overflow: hidden` on the
**surface**, never the container — a surface may legitimately overflow the container's box,
since Godot Controls clip only with `clip_contents`.

**One registry serves both consumer kinds.** `ViewportTextureRegistry` (`nodePath → entry`)
mirrors the **AnimationDriverRegistry**: a stable register function so a publisher's effect
does not re-fire, a reactive map so a consumer re-renders when its target appears. The
entry carries `texture` for WebGL consumers *and* `readPixels` for the DOM surface, which
cannot sample a WebGL texture at all (ADR-0003). Consumers never learn which kind of
content produced the target, so the Control-rasterization path and the FBO path are
interchangeable behind it.

## Considered options

**Render-to-texture for every sub-viewport.** Rejected by measurement: it would hide 3D
content that Godot draws in the parent view, which is the common case in this corpus
(`IconRenderBooth` alone has twelve model booths inside one sub-viewport).

**Inline composite** — render the subtree in place. This is what the previewer did by
accident while the types were unregistered. Correct for 3D, wrong for every CanvasItem.

**Sized placeholder.** Cheapest, and wrong for the four container instances in the corpus,
which display real content.

## Consequences

- The 3D half needed no new rendering machinery: it was already correct by accident, and is
  now correct on purpose with the `own_world_3d` flag honoured.
- Control content inside a surface renders as DOM through a nested `ControlDispatcher` —
  cheaper and sharper than going through pixels, and it covers most of the committed
  corpus. Only 2D-world and 3D content inside a *container* needs a pixel path.
- Node paths inside a sub-viewport stay in the one path space, so selection, the scene
  tree, and the inspector are unaffected by the boundary.
- **Deliberate non-changes**, each of which looks like an inconsistency:
  - **Preview-lighting yield (ADR-0025) stays tree-wide.** Godot's
    `Node3DEditor::_node_added` gates on `get_scene_root()->is_ancestor_of(p_node)` with no
    viewport check, so a `DirectionalLight3D` inside a sub-viewport really does suppress the
    editor's preview sun. The `ref:godot` harness's own port recurses through every child.
  - **`CamerasPanel` / `SceneStats` still list cameras inside sub-viewports.** With the
    shared World3D they really are in this view's world.
  - **The scene tree panel shows the whole subtree**, as Godot's does. Only the
    2D-content hint prunes, via `collectLiveNodes`' `descend` option, because it answers
    "what would the 2D workspace show" rather than "what is in the tree".
- **Known limitations:**
  - `resource_local_to_scene` is unhandled, and materials resolve by identity. A
    `ViewportTexture` on a `[sub_resource]` material is already scene-scoped, but two
    *instances* of the same sub-scene would share one material and therefore one viewport
    binding.
  - A sub-viewport containing Controls has no WebGL source of its own; its texture comes
    from a DOM raster (ADR-0003 as amended). Its text cannot match Godot's, which bundles
    Open Sans SemiBold while the overlay is system-fonts-only.
  - A **recursive** ViewportTexture — a viewport sampling its own target — is unsolved and
    unexercised: no scene in the corpus does it. (`gui_in_3d` looks like it does only
    because its `TextureRect` carries `ExtResource("2")` = `res://icon.webp` while the
    quad's material carries `SubResource("2")` = the ViewportTexture. Same number, two id
    namespaces — a trap worth knowing when reading these scenes.)
  - `render_target_update_mode` does not gate rendering: the previewer derives the target
    from the scene, so there is no per-frame update to skip.

Recorded because the shared-World3D half is genuinely counter-intuitive — it contradicts
the issue's own framing, and a future reader would otherwise "fix" it into a uniform
render-to-texture — and because the `TWO_D_UI_TYPES` divergence is a trade a reader would
otherwise collapse back.
