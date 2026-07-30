---
type: TextureRect
category: 2D
fixture: unit-texture-rect.tscn
image: unit-texture-rect
renders_as: an HTML img element
---

# TextureRect

A Control that displays a `Texture2D` inside its rect. The previewer loads the
texture into an `<img>` positioned to fill the control's box, with `object-fit`
and `object-position` set from `stretch_mode`.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `anchors_preset` | `15` | full-rect anchors — the control fills the whole viewport |
| `texture` | `ExtResource("1_tex")` | the blue "F" marker sprite is drawn |
| `expand_mode` | `1` (EXPAND_IGNORE_SIZE) | the control ignores the texture's natural minimum size |
| `stretch_mode` | `5` (KEEP_ASPECT_CENTERED) | square texture fits the frame height and centers — grey letterbox on the left and right |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin TextureRect -->
Strict parsing format-checks the inherited set (33 inherited from Control); `TextureRect` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

`TextureRect` has no strict counterpart for `expand_mode`, `stretch_mode`, `flip_h`,
or `flip_v`. `expand_mode` and `stretch_mode` use the optional-int reader, so an
absent or unparseable value becomes `undefined` and each falls through its own
switch's default case at render time. `flip_h` / `flip_v` behave differently: a
present-but-unparseable value collapses to `false` rather than `undefined`, since
`parseOptionalBool` only checks for the literal string `true`.

## Known limitations

- **expand_mode FIT_* axis (DOM only)** — the DOM FIT modes take the right shape, but Godot names one axis as the driver from the control's current size, whereas CSS resolves whichever axis the layout leaves unconstrained; they differ only when the layout constrains both axes. **Partially closed by the native (WebGL) solver below** — see its own section for exactly what closes and what cannot without touching the shared `controlRectSolver.ts`.
- **Absent stretch_mode → contain** — an absent `stretch_mode` defaults to `object-fit: contain` (a deliberate deviation from Godot's STRETCH_SCALE default) so a texture fits rather than stretch-distorts; an explicit `stretch_mode = 0` still maps to fill. The native painter below reproduces Godot's actual default (`STRETCH_SCALE`) verbatim instead — a second, independent DOM-vs-native divergence, in the DOM's favour visually but not in fidelity.

## Native (WebGL canvas) painter

`nativeSolver.ts` registers `TextureRect`'s `expand_mode` minimum-size
contribution (`controlSolverRegistry.registerMinimumSize`) and exports the
`stretch_mode` draw-rect math `NativeComponent.tsx` paints — both ported from
`scene/gui/texture_rect.cpp` (4.6.3). `flip_h`/`flip_v` and the `texture_filter`/
`texture_repeat` sampler properties (below) are native-only: CSS has no
per-image sampler control and no non-destructive way to express Godot's
draw-time flip, so both were simply absent from the DOM component.

### The FIT_\* driver-axis divergence — what closes, what doesn't

`TextureRect::get_minimum_size()` (`texture_rect.cpp:107-133`) ties
FIT_WIDTH/FIT_HEIGHT (and their PROPORTIONAL twins) to the control's OWN
**current, already-resolved** size (`get_size().y`/`get_size().x`,
`:116-129`) — self-referential. The DOM component's CSS approximation
(`Component.tsx`'s `textureRectMinSize`) maps FIT_WIDTH (2) and FIT_HEIGHT (4)
to the IDENTICAL `aspect-ratio: 1/1` (ditto the PROPORTIONAL pair, both to the
texture's own aspect) — CSS `aspect-ratio` is symmetric and only ever fills in
whichever axis the layout leaves unconstrained, so it cannot express "Godot
always floors WIDTH from HEIGHT, never the reverse" (or vice versa). The two
approaches only actually diverge once anchors constrain BOTH axes: at that
point `aspect-ratio` goes inert (no auto axis left to solve), while Godot's
floor (`Control::_size_changed`'s `GROW_DIRECTION_*` step,
`control.cpp:1773-1797`) can still override whichever axis it names as driven.

The native solver's `textureRectMinimumSize` (`nativeSolver.ts`) returns an
ASYMMETRIC `Vec2` per mode instead of a single ratio — zero on the axis Godot
never floors, non-zero on the one it does, exactly the `Size2(h, 0)` /
`Size2(0, w)` shape the source itself uses. **This closes the axis-IDENTITY
half of the divergence**: FIT_WIDTH and FIT_HEIGHT are no longer
interchangeable, so a later `floorAtMinimumSize` step floors the CORRECT axis,
never the other one.

**What does not close**: the actual magnitude Godot reads (`get_size().y` for
FIT_WIDTH) is the control's own rect, produced by `controlRectSolver.ts`'s
Phase 2 (top-down) — but `MinimumSizeFn` runs in Phase 1 (bottom-up), before
any rect exists, and is never handed a parent rect
(`native/solverRegistry.ts`'s `MinimumSizeFn` contract). Substituting the
texture's OWN natural size for that unavailable "current size" is the closest
non-circular per-node datum available (and, for the PROPORTIONAL modes,
algebraically collapses to exactly EXPAND_KEEP_SIZE's number on the driven
axis — see `nativeSolver.test.ts`'s worked arithmetic). Closing this fully
would require widening `MinimumSizeFn`'s contract or iterating
`solveControlTree` to a fixed point, both changes to the shared
`controlRectSolver.ts` outside this slice's scope.

### Sampler properties: `texture_filter` / `texture_repeat`

`ControlProperties.textureFilter`/`textureRepeat` (`CanvasItem::TextureFilter`/
`TextureRepeat`, `scene/main/canvas_item.h:52-69`) map to three.js
`NearestFilter`/`LinearFilter` and `RepeatWrapping`/`ClampToEdgeWrapping`/
`MirroredRepeatWrapping`. Both default to `*_PARENT_NODE` (0) — a Control
inherits its EFFECTIVE filter/repeat from the nearest ancestor that names one,
falling back to the viewport. This codebase has no ancestor-chain context for
either property (unlike `modulate`'s `Modulate2DContext`), so `PARENT_NODE`
resolves directly to the CanvasItem ROOT default instead of walking ancestors:
`CANVAS_ITEM_TEXTURE_FILTER_LINEAR` / `CANVAS_ITEM_TEXTURE_REPEAT_DISABLED`
(`canvas_item.h:121-122`'s cache-field initializers) — `linear` / `clamp`,
matching the SAME root default `r3f/spriteFrame.ts`'s `'clamp'` `SpriteWrapMode`
already models for the 2D canvas.

STRETCH_TILE forces repeat wrapping for that one draw regardless of
`texture_repeat` (`draw_texture_rect(texture, rect, tile=true)` is a per-call
sampler override in Godot, not a `texture_repeat` read) — the native painter
mirrors that by hardcoding `RepeatWrapping` whenever `stretch_mode` is TILE,
independent of the resolved `texture_repeat` value.

### flip_h / flip_v

Godot mirrors by negating the DESTINATION rect's size
(`texture_rect.cpp:92-93`), flipping the whole drawn quad — crop region and
all — as one unit. Sprite2D's convention (`nodes/2d/sprite2d/Component.tsx`)
mirrors via mesh `scale`, but that only stays in place when `scale` and
`position` sit on the SAME object centred at its own local origin; TextureRect's
drawn sub-rect is offset from its `<ControlQuad>`'s own placement (KEEP/KEEP_
CENTERED/KEEP_ASPECT let it sit anywhere in the control's box), so mirroring
via mesh scale would shift it. Instead, `nativeSolver.ts`'s `applyFlip` mirrors
the UV window in place (`newOffset = offset + repeat; newRepeat = -repeat`),
composing with whatever `repeat`/`offset` `stretch_mode` already produced
(a KEEP_ASPECT_COVERED crop, a TILE repeat count, or the untouched identity)
rather than resetting it. Verified to still match Godot under `RepeatWrapping`
(TILE + flip): GLSL's `fract()` is a floor-mod, so a negative `repeat` samples
the identical source texel Godot's own `(rectSize - x) mod textureSize` would
— mirroring the WHOLE tiled pattern, never a single tile in isolation. See
`nativeSolver.test.ts`'s worked TILE+flip case.
