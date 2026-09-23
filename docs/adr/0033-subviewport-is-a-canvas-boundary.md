# A sub-viewport is a canvas boundary, not a world boundary

- Status: Accepted
- Numbered ADR-0033 because ADR-0030 is the 2D shadow penumbra polar map. Pull-request
  descriptions outside the tree call this decision ADR-0030.
- Related: ADR-0003 (2D-UI DOM overlay), ADR-0006 (viewport-mode seam and its two
  amendments), ADR-0024 (DOM-overlay browser gate), ADR-0002 (three separate registries).

## Context

`SubViewport` and `SubViewportContainer` appear across the vendored corpus, including the
whole `demos/viewport/` family, plus `godot-open-rts`' `IconRenderBooth.tscn` and
`Match.tscn`.

The three obvious choices, render-to-texture, inline composite and a sized placeholder,
are all wrong, because each assumes a sub-viewport behaves one way. Reference renders
through real Godot 4.6.3 (`pnpm ref:godot`, editor previews injected) show that the
behaviour splits by *content kind*:

| Probe | Result |
| --- | --- |
| `MeshInstance3D` inside a SubViewport, `own_world_3d` unset | **Renders in the parent 3D view**, transform composing as through a plain `Node` |
| same, `own_world_3d = true` | Not rendered |
| same, `disable_3d = true` | **Still rendered**. `disable_3d` does not affect the parent view |
| `ColorRect` inside a SubViewport, sibling `ColorRect` outside | Outside draws. **Inside does not** |
| `viewport/2d_in_3d`, `gui_in_3d`, `3d_in_2d` | Content appears **only** on the ViewportTexture'd surface |

Godot's source says why. `Viewport::Viewport()` always instantiates `world_2d`, so
`find_world_2d` (viewport.cpp:1249) returns its own and never walks up. But
`find_world_3d` (viewport.cpp:4486) falls through to `parent->find_world_3d()` unless
`own_world_3d` is set. The asymmetry is a property of `Viewport` itself, not of
`SubViewport`. Also, `_propagate_drag_notification` (viewport.cpp:1260) skips "a
SubViewport that is not a child of a SubViewportContainer": Godot's own code treats the
container as *the* composed case.

## Decision

**A sub-viewport always owns its World2D and shares its parent's World3D.** Its
CanvasItem descendants, 2D world and Control UI, draw nowhere in the parent. Its Node3D
descendants draw as through a plain `Node` unless `own_world_3d`. A **viewport surface**
displays its target: a `SubViewportContainer`, or a `ViewportTexture` consumer.

**The registration carries the rule, not new dispatcher branches.** `SubViewport`
registers with neither `canvasItem` nor `container`, so `PlainNode`'s workspace rules pass
it through in the 3D workspace and drop its subtree in the 2D one. That is the measured
asymmetry, with no edit to `NodeDispatcher`. The slice owns only the `own_world_3d` gate.
`disable_3d` is not read, on purpose.

**`ControlDispatcher` stops at the boundary.** Without that stop, an unregistered
`SubViewport` in the Control registry falls to `GenericControlFallback`, whose
`display: contents` renders its subtree straight into the parent HUD (for example,
`Match.tscn`'s `MinimapViewport` and fog-of-war `ColorRect`s).

**A viewport surface is the one exception to the 3D-workspace drop.**
`SubViewportContainer` is a Control, so it belongs in `TWO_D_UI_TYPES`. That set mirrors
the Control registry and drives the 2D-content hint and the root-workspace rule. But to
drop its *subtree* in the 3D workspace would take a contained sub-viewport's 3D content
with it, and Godot draws that content. So the two questions `TWO_D_UI_TYPES` answers, "is
this 2D UI" and "does the 3D canvas skip its subtree", diverge here, and the dispatcher
subtracts `VIEWPORT_SURFACE_TYPES`. Do not collapse the two back into one.

**Surface geometry, measured** (300×200 container at (100,80), 200×150 sub-viewport):

| `stretch` | Drawn rect | Content laid out against |
| --- | --- | --- |
| `false` (default) | **200×150** at the container's top-left, the *viewport's* size | `SubViewport.size` |
| `true` | **300×200**, the container's own rect | `get_size() / stretch_shrink` |

`SubViewportContainer::_notification(NOTIFICATION_DRAW)` loops **every** SubViewport
child and draws each, stacked in tree order, not only the first. Clipping is a
consequence, not an operation. The container issues no clip, but the target is only
`size` pixels, so content beyond it is never rendered. The DOM equivalent puts
`overflow: hidden` on the **surface**, never the container. A surface may overflow the
container's box, since Godot Controls clip only with `clip_contents`.

**The seam runs both ways.** A second registry, `ViewportRectContext`
(`r3f/contexts/ViewportRectContext.tsx`), carries a measurement back. With `stretch` on,
`recalc_force_viewport_sizes` makes the container's rect the viewport's size, so the
number the target is allocated from lives in the DOM overlay, while the target lives in
the R3F root. The surface measures its own box and publishes it under the same node path.
`<SubViewport>` prefers it over the authored `size`, and falls back when none is
published. That fallback is Godot's early return for a non-stretching container, and the
only behaviour for a sub-viewport with no container. It is separate from the texture
registry, not a wider `ViewportTextureEntry`: the two travel in opposite directions and
have different lifetimes, and a consumer of one must not re-render because the other
changed.

**One registry serves both consumer kinds.** `ViewportTextureRegistry`
(`nodePath → entry`) mirrors the **AnimationDriverRegistry**: a stable register function,
so a publisher's effect does not re-fire, and a reactive map, so a consumer re-renders
when its target appears. The entry carries `texture` for WebGL consumers and `readPixels`
for the DOM surface, which cannot sample a WebGL texture (ADR-0003). Consumers do not
learn which kind of content produced the target, so the Control-rasterisation path and
the FBO path are interchangeable behind it.

## Considered options

**Render-to-texture for each sub-viewport.** Rejected by measurement. It hides 3D content
that Godot draws in the parent view, which is the common case in this corpus
(`IconRenderBooth` has twelve model booths inside one sub-viewport).

**Inline composite**, which renders the subtree in place. Correct for 3D, wrong for each
CanvasItem.

**Sized placeholder.** Cheapest, and wrong for the container instances in the corpus,
which display real content.

## Consequences

- The 3D half needs no new rendering machinery, only the `own_world_3d` flag.
- Control content inside a surface renders as DOM through a nested `ControlDispatcher`,
  cheaper and sharper than pixels. 2D-world and 3D content inside a *container* takes the
  pixel path instead. The surface snapshots the published target through `readPixels`
  and paints it into a `<canvas>` stacked under the Control layer. It applies the sRGB
  encode that the target's `LinearSRGBColorSpace` tag defers (measured against Godot
  4.6.3 on `unit-sub-viewport-container-2d-content.tscn`).
- A sub-viewport that contains Controls publishes its texture through a native offscreen
  pass in the same `ControlCanvasWalker` as each other Control (ADR-0037).
- A Camera2D frames only a sub-viewport, since the 2D stage frames the project viewport.
  A `ParallaxBackground` is a `CanvasLayer` whose layer transform tracks the viewport's
  canvas transform (`parallax_background.cpp::_camera_moved` → `set_scroll_offset`), so
  it covers a Camera2D-framed surface wherever the camera goes.
- Node paths inside a sub-viewport stay in the one path space, so the boundary does not
  affect selection, the scene tree or the inspector.
- **Deliberate non-changes**, each of which looks like an inconsistency:
  - **Preview-lighting yield (ADR-0025) stays tree-wide.** Godot's
    `Node3DEditor::_node_added` gates on `get_scene_root()->is_ancestor_of(p_node)` with
    no viewport check, so a `DirectionalLight3D` inside a sub-viewport does suppress the
    editor's preview sun. The `ref:godot` harness's own port recurses through each child.
  - **`CamerasPanel` / `SceneStats` list cameras inside sub-viewports.** With the shared
    World3D they are in this view's world.
  - **The scene tree panel shows the whole subtree**, as Godot's does. Only the
    2D-content hint prunes, through `collectLiveNodes`' `descend` option, because it
    answers "what would the 2D workspace show", not "what is in the tree".
- **Known limitations:**
  - `resource_local_to_scene` is unhandled, and materials resolve by identity. A
    `ViewportTexture` on a `[sub_resource]` material is scene-scoped, but two
    *instances* of the same sub-scene share one material and so one viewport binding.
  - A **recursive** ViewportTexture, a viewport that samples its own target, is unsolved
    and no corpus scene does it. `gui_in_3d` only looks like one: its `TextureRect`
    carries `ExtResource("2")` = `res://icon.webp`, while the quad's material carries
    `SubResource("2")` = the ViewportTexture. Same number, two id namespaces.
  - `render_target_update_mode` does not gate rendering. The previewer derives the target
    from the scene, so there is no per-frame update to skip.
  - A surface's pixels stop updating once they settle. `readRenderTargetPixels` is a
    synchronous GPU stall, so the blit samples on a bounded one-shot schedule and re-arms
    only on a new target or a fresh parse. An `AnimationPlayer` inside a sub-viewport
    shows its settled frame there.
  - The resolved tree decides which rasteriser owns a target, so an `instance=` child
    that has not loaded is classified provisionally and re-classified when its sub-scene
    lands. A cyclic sub-scene reference stops the resolver at 32 levels.
