---
type: TextureRect
category: 2D
fixture: unit-texture-rect.tscn
image: unit-texture-rect
renders_as: a textured quad in the control's rect
---

# TextureRect

A Control that displays a `Texture2D` inside its rect. The previewer draws the
texture as a quad, with the draw rect and UV window computed from `stretch_mode`
and `expand_mode`.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `anchors_preset` | `15` | full-rect anchors — the control fills the whole viewport |
| `texture` | `ExtResource("1_tex")` | the blue "F" marker sprite is drawn |
| `expand_mode` | `1` (EXPAND_IGNORE_SIZE) | the control ignores the texture's natural minimum size |
| `stretch_mode` | `5` (KEEP_ASPECT_CENTERED) | square texture fits the frame height and centers — grey letterbox on the left and right |

## Divergences

None visible in this fixture. `pnpm ref:godot
scenes/fixtures/unit-texture-rect.tscn --mode 2d` against `pnpm ref:ours
unit-texture-rect.tscn --2d`: mean channel error 0.0057/255, max channel
difference 2/255, on 1.4 % of pixels — all of it on the magnified texel edges
of the upscaled marker, the same four-pixel bilinear-ramp residual
`tilemaplayer/comparison.md` measures at its own boundary pixel (a genuine
hardware bilinear-filter rounding tie, not a colour-space mismatch — the 2D
canvas's atlas texture is sampled `NoColorSpace` so the filter blends raw sRGB
bytes, matching Godot's own canvas). The letterbox boundaries, the drawn rect
and the fill colour agree.

`texture_filter`/`texture_repeat` resolve `PARENT_NODE` through the Control
ancestor chain to the nearest node that names one
(`r3f/canvasItemTextureSampler.ts`), not straight to the viewport default.
`unit-texture-rect-filter-inherit.tscn` isolates this: three TextureRects
sample the same 8x8 checkerboard 25x magnified, none naming its own filter —
one inherits NEAREST from its immediate parent, one inherits NEAREST from its
GRANDPARENT past an explicit PARENT_NODE ancestor in between, and one has no
naming ancestor at all (the viewport-default LINEAR baseline). `pnpm
ref:godot scenes/fixtures/unit-texture-rect-filter-inherit.tscn --mode 2d
--probe 45,25 --probe 295,25 --probe 545,25` against `pnpm ref:ours
unit-texture-rect-filter-inherit.tscn --2d --probe 45,25 --probe 295,25
--probe 545,25`, probed at a checker-cell boundary on each quad:

| Probe | Case | Godot | Ours |
| --- | --- | --- | --- |
| `45,25` | immediate-parent NEAREST | `rgb(16, 16, 16)` | `rgb(16, 16, 16)` |
| `295,25` | grandparent NEAREST, past PARENT_NODE | `rgb(16, 16, 16)` | `rgb(16, 16, 16)` |
| `545,25` | no naming ancestor (LINEAR baseline) | `rgb(93, 93, 93)` | `rgb(92, 92, 92)` |

The two inherited-NEAREST probes match exactly; the LINEAR baseline's 1/255
gap is the same hardware bilinear-filter rounding tie `unit-texture-rect.tscn`'s
own Divergences measures — not a colour-space or inheritance defect.

## Linting

<!-- lint:begin TextureRect -->
Strict parsing format-checks the inherited set (35 inherited from Control); `TextureRect` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `control-property-order` (type-family match) | `control-property-order` | warning |
<!-- lint:end -->

`TextureRect` has no strict counterpart for `expand_mode`, `stretch_mode`, `flip_h`,
or `flip_v`. `expand_mode` and `stretch_mode` use the optional-int reader, so an
absent or unparseable value becomes `undefined` and each falls through its own
switch's default case at render time. `flip_h` / `flip_v` behave differently: a
present-but-unparseable value collapses to `false` rather than `undefined`, since
`parseOptionalBool` only checks for the literal string `true`.

## Native (WebGL canvas) painter

`nativeSolver.ts` registers `TextureRect`'s `expand_mode` minimum-size
contribution (`controlSolverRegistry.registerMinimumSize`) and exports the
`stretch_mode` draw-rect math `Component.tsx` paints — both ported from
`scene/gui/texture_rect.cpp` (4.6.3). `flip_h`/`flip_v` and the `texture_filter`/
`texture_repeat` sampler properties (below) are drawn from the same port;
`stretch_mode`'s default is Godot's own `STRETCH_SCALE`, not a fit.

### The FIT_\* driver axis — identity AND magnitude

`TextureRect::get_minimum_size()` (`texture_rect.cpp:107-133`) ties
FIT_WIDTH/FIT_HEIGHT (and their PROPORTIONAL twins) to the control's OWN
**current, already-resolved** size (`get_size().y`/`get_size().x`,
`:116-129`) — self-referential. It names ONE axis as the driver and never the
other, which is exactly what a symmetric ratio cannot express.

`textureRectMinimumSize` (`nativeSolver.ts`) returns an ASYMMETRIC `Vec2` per
mode instead of a single ratio — zero on the axis Godot never floors, non-zero
on the one it does, exactly the `Size2(h, 0)` / `Size2(0, w)` shape the source
itself uses. **This gets the axis IDENTITY right**: FIT_WIDTH and FIT_HEIGHT are
not interchangeable, so a later `floorAtMinimumSize` step floors the CORRECT
axis, never the other one.

**Magnitude closes too**, via `SolveContext.tentativeRect`
(`native/solverRegistry.ts`): `solveControlTree` runs a bounded second pass —
feeding a first pass's own resolved rects back in — whenever the tree
contains a type registered via `registerSizeDependentMinimum`, which this
type's `index.r3f.ts` does. On that second pass, `tentativeRect(n).h`/`.w` IS
`get_size().y`/`.x` — the REAL, already-resolved control size, not a
substitute. The first pass still substitutes the texture's OWN natural size
on that axis (unavailable otherwise), which is algebraically identical to
what the corrected formula produces once fed that same substitute — so a
FIT_\* TextureRect with nothing else depending on its own size already
converges on the first pass, and the second pass only changes the answer
when something genuinely constrains the non-driven axis to a DIFFERENT
value (an anchor, a sibling, a container) — see `nativeSolver.test.ts`'s
`tentativeRect`-aware cases and `solveControlTree`'s own end-to-end case for
the worked numbers.

### Sampler properties: `texture_filter` / `texture_repeat`

`ControlProperties.textureFilter`/`textureRepeat` (`CanvasItem::TextureFilter`/
`TextureRepeat`, `scene/main/canvas_item.h:52-69`) map to three.js
`NearestFilter`/`LinearFilter` and `RepeatWrapping`/`ClampToEdgeWrapping`/
`MirroredRepeatWrapping`. Both default to `*_PARENT_NODE` (0) — a Control
inherits its EFFECTIVE filter/repeat from the nearest ancestor that names one,
falling back to the viewport when none does. `useInheritedTextureSampler`
(`r3f/canvasItemTextureSampler.ts`) walks that chain — the same
own-or-ambient shape `modulate`'s `Modulate2DContext` uses, minus the
multiplicative fold, since neither property has a self-only layer. `undefined`
(no naming ancestor) is what the mapping functions below resolve to the
CanvasItem ROOT default — a CanvasItem with no `parent_item` falls back to the
RenderingServer's own `CANVAS_ITEM_TEXTURE_FILTER_DEFAULT`/`_REPEAT_DEFAULT`
sentinel, which resolves through to the OWNING VIEWPORT's own
`default_canvas_item_texture_filter`/`_repeat` (`scene/main/viewport.h:418-419`),
whose class defaults are `LINEAR`/`DISABLED` — `linear` / `clamp`, matching
the SAME root default `r3f/spriteFrame.ts`'s `'clamp'` `SpriteWrapMode`
already models for the 2D canvas. A `CanvasLayer` boundary resets the ambient
back to that same root default (`canvasLayerScope.tsx`), matching
`get_parent_item()` returning null there for the identical reason `modulate`
resets to white.

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
