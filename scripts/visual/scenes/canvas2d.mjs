/**
 * The 2D canvas: polygons and lines, y-sorting, the PointLight2D surface with
 * its cull masks and occluder shadows, CPUParticles2D, 2D navigation and
 * parallax.
 */

export const CANVAS_2D_SCENES = [
  // 2D nodes render in the 2D view (with its zoom/pan chrome) — relax the
  // threshold like the other 2D goldens (marker2d/path2d).
  { name: 'polygon-2d', file: 'unit-polygon2d.tscn', maxDiffPct: 0.5, mode: '2d' },
  { name: 'line-2d', file: 'unit-line2d.tscn', maxDiffPct: 0.5, mode: '2d' },
  // A y-sorted node's OWN body, between the two children it merges into the
  // same sort. Godot probes: (200,330) yellow — the bar covers the red block;
  // (700,330) blue — the blue one covers the bar. Without the body the first
  // is red, which no other golden would notice.
  { name: 'ysort-own-body', file: 'unit-ysort-own-body.tscn', maxDiffPct: 0.5, mode: '2d' },
  // The 2D light surface: ADD/SUB/MIX applied against a lit surface, and an
  // inline gradient cookie under a canvas tint with an unshaded item beside it.
  { name: 'pointlight2d-blend', file: 'unit-pointlight2d-blend.tscn', maxDiffPct: 0.5, mode: '2d' },
  { name: 'pointlight2d-gradient', file: 'unit-pointlight2d-gradient.tscn', maxDiffPct: 0.5, mode: '2d' },
  { name: 'pointlight2d-lightonly', file: 'unit-pointlight2d-lightonly.tscn', maxDiffPct: 0.5, mode: '2d' },
  // Godot's light culling: `light.range_item_cull_mask & item.light_mask != 0`.
  // Four panels under two lights of different cull masks: one panel takes only
  // the warm light, its NEIGHBOUR only the cool one, the third both, and the
  // fourth sits right under the cool light and takes neither. Nothing else in
  // the goldens sets either mask, so without this a light that reached
  // everything under it would move no baseline at all.
  { name: 'pointlight2d-cull-mask', file: 'unit-pointlight2d-cull-mask.tscn', maxDiffPct: 0.5, mode: '2d' },
  // The two range windows, which are the other half of the same cull test.
  // `range_z_max = 4` over panels at z_index 0, 4 and 5 pins the per-ITEM z
  // window and its inclusive upper bound; a default light over a world panel and
  // a bare CanvasLayer panel pins the per-CANVAS layer window, whose 0..0
  // default is why Godot never lights an untouched HUD.
  { name: 'pointlight2d-range-z', file: 'unit-pointlight2d-range-z.tscn', maxDiffPct: 0.5, mode: '2d' },
  { name: 'pointlight2d-range-layer', file: 'unit-pointlight2d-range-layer.tscn', maxDiffPct: 0.5, mode: '2d' },
  // LightOccluder2D shadows, one behaviour per fixture. A shadow withholds a
  // light from the geometry behind the occluder; it never darkens what the
  // light did not reach, so an unlit surface is the same grey either way.
  { name: 'lightoccluder2d-shadow-closed', file: 'unit-lightoccluder2d-shadow-closed.tscn', maxDiffPct: 0.5, mode: '2d' },
  // These two had fixtures and comparison images but no baseline, so nothing
  // guarded them — including `unit-lightoccluder2d-shadow`, the single-edge case
  // the LightOccluder2D sheet leads with. Every other occluder behaviour was
  // pinned, which is exactly why the gap was easy to miss.
  { name: 'lightoccluder2d', file: 'unit-lightoccluder2d.tscn', maxDiffPct: 0.5, mode: '2d' },
  { name: 'lightoccluder2d-shadow', file: 'unit-lightoccluder2d-shadow.tscn', maxDiffPct: 0.5, mode: '2d' },
  // `cull_mode` 0/1/2: which winding of an occluder's edges casts. The reversed
  // pair is the same two occluders with the polygon wound the other way, so
  // CLOCKWISE and COUNTER_CLOCKWISE swap and DISABLED stays put — a cull test
  // that read winding-independently would leave one of the two baselines flat.
  { name: 'lightoccluder2d-cull-mode', file: 'unit-lightoccluder2d-cull-mode.tscn', maxDiffPct: 0.5, mode: '2d' },
  { name: 'lightoccluder2d-cull-mode-reversed', file: 'unit-lightoccluder2d-cull-mode-reversed.tscn', maxDiffPct: 0.5, mode: '2d' },
  // `shadow_color` is the light's, not the occluder's, and it REPLACES the light
  // term rather than withholding it. It is also the one light term Godot does not
  // multiply by the item's albedo, so it rides its own accumulator — a baseline
  // that folded it into the ordinary one would sit a whole albedo out.
  { name: 'lightoccluder2d-shadow-color', file: 'unit-lightoccluder2d-shadow-color.tscn', maxDiffPct: 0.5, mode: '2d' },
  // `shadow_item_cull_mask & occluder.light_mask`: one occluder casts, its twin
  // is culled by the same light.
  { name: 'lightoccluder2d-shadow-mask', file: 'unit-lightoccluder2d-shadow-mask.tscn', maxDiffPct: 0.5, mode: '2d' },
  // Two shadowed lights in one accumulation pass: each must clear the stencil
  // before it stamps, or the first light's volume also cuts the second's.
  { name: 'lightoccluder2d-two-lights', file: 'unit-lightoccluder2d-two-lights.tscn', maxDiffPct: 0.5, mode: '2d' },
  // `shadow_filter`: the boundary is a STEPPED penumbra, not an edge, and every
  // occluder fixture above leaves the property at NONE — so without these three
  // the whole filtered mechanism is unpinned. The occluder's upper endpoint sits
  // at the light's own y, which puts the umbra boundary on the horizontal ray
  // and lets a vertical probe cross it perpendicular. Godot 4.6.3, transect at
  // x=676: 167 / 129 / 100 / 80 / 67 / 63 of 255 — the five PCF5 levels under
  // the (1-s)^2 falloff, with the step boundaries 19.4 px either side of the
  // geometric edge. PCF13 spreads the same ramp over the wider kernel, and the
  // colour fixture pins the fractional tint the two accumulators split.
  { name: 'pointlight2d-shadow-pcf5', file: 'unit-pointlight2d-shadow-pcf5.tscn', maxDiffPct: 0.5, mode: '2d' },
  { name: 'pointlight2d-shadow-pcf13', file: 'unit-pointlight2d-shadow-pcf13.tscn', maxDiffPct: 0.5, mode: '2d' },
  { name: 'pointlight2d-shadow-pcf-color', file: 'unit-pointlight2d-shadow-pcf-color.tscn', maxDiffPct: 0.5, mode: '2d' },
  // CPUParticles2D renders a FROZEN pose, so these baselines are what prove it
  // settles: a live emitter would never produce two identical frames and the
  // harness would fail it as unstable rather than as changed. Each fixture pins
  // `use_fixed_seed`/`seed`/`fixed_fps`/`preprocess` so the pose is one exact
  // draw rather than a plausible one.
  { name: 'cpuparticles2d', file: 'unit-cpuparticles2d.tscn', maxDiffPct: 0.5, mode: '2d' },
  { name: 'cpuparticles2d-emission-shapes', file: 'unit-cpuparticles2d-emission-shapes.tscn', maxDiffPct: 0.5, mode: '2d' },
  { name: 'cpuparticles2d-curves', file: 'unit-cpuparticles2d-curves.tscn', maxDiffPct: 0.5, mode: '2d' },
  { name: 'cpuparticles2d-color-ramp', file: 'unit-cpuparticles2d-color-ramp.tscn', maxDiffPct: 0.5, mode: '2d' },
  // A scaled emitter whose particles must NOT scale with it: Godot's default
  // `local_coords = false` emits into world space, which the dungeon candle relies on.
  { name: 'cpuparticles2d-local-coords', file: 'unit-cpuparticles2d-local-coords.tscn', maxDiffPct: 0.5, mode: '2d' },
  // `emitting = false` draws nothing. Script-triggered one-shot emitters ship
  // this way, so a regression that started drawing them would be widespread.
  { name: 'cpuparticles2d-not-emitting', file: 'unit-cpuparticles2d-not-emitting.tscn', maxDiffPct: 0.5, mode: '2d' },
  // Baseline corrected in the Y-flip fix: a NavigationPolygon's vertices are
  // Godot canvas pixels (+Y DOWN), and this overlay was the one 2D geometry
  // path where skipping the negation puts the navmesh ABOVE the region origin
  // instead of below it.
  { name: 'navigation-region-2d', file: 'unit-navigation-region-2d.tscn', maxDiffPct: 0.5, mode: '2d' },
  // A ParallaxBackground is a CanvasLayer: its subtree hangs off the VIEWPORT,
  // so the blue bar stays at the canvas origin while the red reference bar under
  // the same displaced parent moves with it. Every other 2D golden composes
  // transforms the ordinary way and would still match if that chain were
  // re-attached.
  { name: 'parallax-background', file: 'unit-parallax-background.tscn', maxDiffPct: 0.5, mode: '2d' },
  // `motion_mirroring` draws the layer a SECOND time, 200 px right — the only
  // repeated canvas subtree in the corpus, and the only property of a
  // ParallaxLayer a camera-less still frame can show at all.
  { name: 'parallax-layer', file: 'unit-parallax-layer.tscn', maxDiffPct: 0.5, mode: '2d' },
  // The one emitter that authors no `preprocess`, so it is the only one whose
  // instant the previewer substitutes rather than reads. Its lifetime is
  // deliberately not a multiple of the step, so the settle's whole-frame
  // overshoot is in the picture. Arbitrated against Godot at the same instant
  // via `--particles 0.95`; the fixture header carries the command.
  { name: 'cpuparticles2d-unpreprocessed', file: 'unit-cpuparticles2d-unpreprocessed.tscn', mode: '2d' },
  // The one emitter here that does NOT pin its seed, so it is the only one that
  // exercises the substituted one. Godot cannot draw this scene the same way
  // twice; the previewer must, and this baseline is the whole assertion of that.
  // Its image records OUR pose and is not arbitrable against a reference.
  { name: 'cpuparticles2d-unseeded', file: 'unit-cpuparticles2d-unseeded.tscn', mode: '2d' },
  // The ONE variable: a Sprite2D that MAGNIFIES its texture. Every other sprite
  // scene draws at 1:1, where a bilinear filter lands on texel centres and
  // never blends two texels, so the colour space the canvas blends in cannot
  // move a pixel in any of them. Godot's 64px ramp across one hard
  // black/white boundary is linear in the ENCODED bytes — rgb(129) at the
  // midpoint against the 189 a decode-before-filter order gives.
  { name: 'sprite2d-magnified', file: 'unit-sprite2d-magnified.tscn', mode: '2d' },
  // A Sprite2D whose `texture` is an INLINE GradientTexture2D — no file, no
  // path, rasterised out of the scene. Every other sprite scene points at an
  // image, so a regression in the procedural branch leaves all of them
  // pixel-identical while this one loses its quad to a placeholder.
  {
    name: 'sprite2d-gradienttexture',
    file: 'unit-sprite2d-gradienttexture.tscn',
    mode: '2d',
  },
  // --- Native Control rendering (ADR-0037) ---
  // Controls draw into the WebGL canvas like every other 2D item, so for the
  // first time they can be golden-gated at all. Each scene below moves ONE
  // piece of that renderer and its fixture header says which; between them
  // they cover the container solve, the StyleBoxFlat raster, the text engine,
  // a composite widget, clipping, and a viewport surface. The parity capture is
  // a 1:1 frame with no camera fit, and these draw flat fills and glyphs rather
  // than shaded geometry.
  //
  // Every scene's layout was measured through Godot 4.6.3 at `--mode 2d`
  // before its baseline was written; the fixtures record the probes.
  { name: 'vbox-container-pitch', file: 'unit-vbox-container-pitch.tscn', mode: '2d' },
  { name: 'panel-styleboxes', file: 'unit-panel-styleboxes.tscn', mode: '2d' },
  // The ONE variable: the WHOLE-PASS stages `StyleBoxFlat::draw` runs, rather
  // than the parameters of the ring `panel-styleboxes` above already varies.
  // `skew` shears the box without moving it and turns anti-aliasing on by
  // itself; the drop shadow is a stage drawn before everything else. Neither
  // changes a radius or a border width, so a regression in either is invisible
  // in every other stylebox scene — and the fixture's own header says which
  // pane pins which half.
  { name: 'panel-stylebox-skew-shadow', file: 'unit-panel-stylebox-skew-shadow.tscn', mode: '2d' },
  { name: 'label-wrap', file: 'unit-label-2d-wrap.tscn', mode: '2d' },
  // The ONE variable: `vertical_alignment`. Every other Label in the bag is
  // V_TOP, where the offset is zero and Godot's int conversion of it is a
  // no-op, so the CENTER/BOTTOM/FILL branches are drawn by nothing else.
  { name: 'label-valign', file: 'unit-label-2d-valign.tscn', mode: '2d' },
  // `label-wrap` above (and every other Control golden) renders through the
  // bundled default MSDF atlas — none of them authors a Theme or a scene
  // font. This is the first: a Theme `.tres`'s `default_font`/
  // `default_font_size`, applied via `theme =` on the root Control and
  // resolved for two Labels with no local font override at all, one direct
  // child and one two hops down through a themeless wrapper Control — the
  // ancestor walk is what resolves them, not a node-local read. Fixture
  // header has the full rationale and the measured probes.
  { name: 'control-scene-font-theme', file: 'unit-control-scene-font-theme.tscn', mode: '2d' },
  // Same wiring, a `.woff2` `default_font` instead of a `.otf` one — the ONE
  // variable is the ascent/descent FALLBACK path (`sfntTables.ts` cannot table-
  // parse Brotli-compressed WOFF2, so this font's line metrics come from
  // canvas `TextMetrics.fontBoundingBoxAscent`/`.fontBoundingBoxDescent`
  // instead of a real `head`/`hhea` read) rather than the sibling's real SFNT
  // table read. Different typeface than the sibling on purpose — no same-face
  // `.woff2`/`.otf` pair exists in the corpus — so it is arbitrated on its own
  // terms against Godot, never against the sibling's baseline.
  { name: 'control-scene-font-woff2', file: 'unit-control-scene-font-woff2.tscn', mode: '2d' },
  // The ONE variable: a scene font drawn MAGNIFIED. Both siblings above draw
  // their scene-font Labels at 1x, where the canvas raster is sampled at the
  // size it was painted and no filter kernel is exercised at all. A scaled one
  // is the only shape in the bag where the sampling colour space of the
  // canvas-painted glyph texture can be read off the ramp — the fixture header
  // carries the arbitration that settled which space is correct.
  {
    name: 'control-scene-font-magnified',
    file: 'unit-control-scene-font-magnified.tscn',
    mode: '2d',
  },
  // The FIRST dedicated coverage for RichTextLabel. `complex-2d-gui` renders
  // one, but that composition scene moves many widgets at once and cannot
  // localise a regression to this type. Exercises the whole supported bbcode
  // subset in one pass — bold via embolden, italic via skew, the underline
  // rule, and a colour span — each already probed against the engine. Its
  // styled runs carry a standing sub-pixel vertical residual against Godot
  // that is a FreeType light-hinting limit rather than a defect; the slice's
  // sheet records the measurement, and this golden exists so a change to span
  // layout cannot move those runs invisibly.
  { name: 'richtext-label-bbcode', file: 'unit-rich-text-label.tscn', mode: '2d' },
  { name: 'button-states', file: 'unit-button-states.tscn', mode: '2d' },
  // The ONE variable each: `anchors_preset` authored WITHOUT any explicit
  // `anchor_*` and without a `layout_mode`. Godot's setter is non-operational
  // in that state and ours applied it anyway; an editor-saved scene always
  // writes the matching `anchor_*` alongside the preset, so no other scene in
  // the bag can reach the gated path.
  {
    name: 'control-anchors-preset-gate',
    file: 'unit-control-anchors-preset-gate.tscn',
    mode: '2d',
  },
  // Its sibling: the preset's OFFSET side effect, in the only shape where it
  // survives the minimum-size floor — an authored `grow_*` that contradicts the
  // preset, so the rewritten offsets are not a fixed point.
  {
    name: 'control-anchors-preset-offsets',
    file: 'unit-control-anchors-preset-offsets.tscn',
    mode: '2d',
  },
  // The ONE variable: a vendored default-theme icon drawn MAGNIFIED. The theme
  // icons come from their own loader rather than the res:// resource pipeline,
  // and every other Control scene draws them at their natural size, so no
  // golden here can see their sampling colour space. Godot's ramp at the
  // checked icon's left edge dips to rgb(72) BELOW the 76 backdrop — a
  // signature only blending the encoded bytes produces.
  {
    name: 'checkbox-icon-magnified',
    file: 'unit-checkbox-icon-magnified.tscn',
    mode: '2d',
  },
  // A TextureRect and a Button icon fed by an INLINE GradientTexture2D. The
  // texture drives each node's MINIMUM SIZE as well as its pixels, so the
  // container sibling below it moves too — these report a layout regression,
  // not only a paint one.
  {
    name: 'texturerect-gradienttexture',
    file: 'unit-texturerect-gradienttexture.tscn',
    mode: '2d',
  },
  {
    name: 'button-icon-gradienttexture',
    file: 'unit-button-icon-gradienttexture.tscn',
    mode: '2d',
  },
  // Three TextureRects fed by INLINE AtlasTextures — cells windowed out of one
  // sprite sheet. The cell's region drives the node's minimum size as well as
  // its pixels, and each rect shrinks to that minimum, so a wrong region shows
  // as a wrong rect in both axes AND moves the sibling below it. The sheet is
  // four flat colours, so which cell was sampled is unmistakable; the third
  // cell carries a `margin`, which widens the reported box and insets the
  // region inside it.
  {
    name: 'texturerect-atlastexture',
    file: 'unit-texturerect-atlastexture.tscn',
    mode: '2d',
  },
  // Three TextureRects on one 8x8 checkerboard magnified 25x, none of them
  // naming a texture_filter: the left two must inherit NEAREST from an
  // ancestor (one from its parent, one from its grandparent past a node left
  // on PARENT_NODE), the right one has no naming ancestor and stays on the
  // viewport-default LINEAR. The variable is the ancestor WALK, not the
  // sampler mapping — a regression that resolves PARENT_NODE straight to the
  // viewport default leaves all three soft, and every other TextureRect scene
  // stays exact because none of them puts a naming ancestor above an
  // inheriting one. Hard vs soft checker edges, so the diff is unmistakable.
  {
    name: 'texturerect-filter-inherit',
    file: 'unit-texture-rect-filter-inherit.tscn',
    mode: '2d',
  },
  // The same atlas decode reached through SpriteFrames instead of a plain
  // Texture2D slot. The two share the decode but not the resource pools it
  // resolves against, so the entry above can be exact while this one draws
  // nothing.
  {
    name: 'animatedsprite2d-atlas',
    file: 'unit-animatedsprite2d-atlas.tscn',
    mode: '2d',
  },
  { name: 'scroll-container-clip', file: 'unit-scroll-container-clip.tscn', mode: '2d' },
  // The two SubViewportContainer surfaces. `sub-viewport-texture` above is a
  // SubViewport sampled by a MESH, which is a different consumer entirely — it
  // passed at 0 px throughout a window in which the container path drew nothing
  // at all, so a golden on the mesh side can say nothing about this one.
  // `-controls` holds Controls, which the container mounts and draws live;
  // `-2d-content` holds Polygon2Ds, which only reach it as the offscreen pass
  // driver's published texture. Neither substitutes for the other: the live arm
  // renders whether or not a single pixel ever leaves a render target.
  // Both were measured against Godot 4.6.3 at `--mode 2d` before their
  // baselines were written: `-controls` is pixel-identical to the engine over
  // the whole frame, and `-2d-content` is within 1/255 everywhere — the 8-bit
  // linear intermediate the SubViewportContainer sheet already documents.
  { name: 'sub-viewport-container-controls', file: 'unit-sub-viewport-container.tscn', mode: '2d' },
  {
    name: 'sub-viewport-container-2d-content',
    file: 'unit-sub-viewport-container-2d-content.tscn',
    mode: '2d',
  },
  // Both scenes above place their container at the scene origin, where a rect
  // solved half its own size off is indistinguishable from the surface being
  // authored there — which is exactly how a missing `get_minimum_size` port
  // stayed invisible. This one takes its rect from a size-consuming parent
  // instead of its own offsets, so the minimum size is load-bearing.
  {
    name: 'sub-viewport-container-centred',
    file: 'unit-sub-viewport-container-centred.tscn',
    mode: '2d',
  },
  // The ONE variable: a Label that AUTOWRAPS inside a container that sizes to
  // it. `label-wrap` above puts its wrapped Labels at authored widths with
  // nothing above them to be wrong against, so a wrapped height that never
  // reaches its parent moves no pixel there. Here the card's own height is the
  // measurement.
  {
    name: 'label-autowrap-in-container',
    file: 'unit-label-autowrap-in-container.tscn',
    mode: '2d',
  },
  // The ONE variable: a ScrollContainer whose bar rects land on a FRACTION.
  // `scroll-container-clip` above is 600x500 with an even bar thickness, so its
  // bar origins are whole numbers and the per-canvas-item snap is a no-op in
  // it — it cannot see this at all.
  {
    name: 'scroll-container-bar-snap',
    file: 'unit-scroll-container-bar-snap.tscn',
    mode: '2d',
  },
  // The ONE variable: a canvas clip quantized to a WHOLE pixel from a position
  // and a size rounded SEPARATELY. `scroll-container-bar-snap` above puts its
  // clip at a fractional edge but a whole-pixel ORIGIN, where the two roundings
  // collapse into one and agree for every size fraction — it cannot tell the
  // separate rounding from an edge rounding. This scene reaches a fractional
  // origin through a scaled ancestor, which is the only place they differ.
  // Measured against Godot 4.6.3 at `--mode 2d` before its baseline was
  // written: pixel-identical to the engine over the whole frame.
  {
    name: 'scroll-container-clip-quantize',
    file: 'unit-scroll-container-clip-quantize.tscn',
    mode: '2d',
  },
  // The composition scene. It deliberately breaks the one-variable rule every
  // entry above follows: it moves many at once and can never localise a
  // regression, and the `unit-*` fixture that owns a type is still where one
  // gets localised. It exists to catch the interactions a single-variable scene
  // has, by construction, nothing to interact with — the two faults it found on
  // its first capture were each invisible to all 23 single-widget scenes.
  // Text-dense, so MSDF stem antialiasing dominates its diff.
  { name: 'complex-2d-gui', file: 'complex-2d-gui.tscn', mode: '2d' },
  // The ONE variable: whether an ancestor's `modulate` crosses a CanvasLayer
  // boundary. Both node families are here because the Control walk and the
  // Node2D dispatch publish that scope through separate code paths, so a leak
  // in one is invisible in the other. Measured against Godot 4.6.3 at
  // `--mode 2d` before its baseline was written: the two in-layer squares read
  // rgb(255,255,255) and the two outside read rgb(64,64,64), on both sides.
  {
    name: 'canvas-layer-modulate-scope',
    file: 'unit-canvas-layer-modulate-scope.tscn',
    mode: '2d',
  },
  // The ONE variable: a Control promoted past a non-Control ancestor, one
  // facet per scene. All three are here because the walk resets the whole
  // chain at a broken CanvasItem link, so a fix to one facet can silently
  // move another. Measured against Godot 4.6.3 at `--mode 2d` before their
  // baselines were written: mean 0.001, 0.006 and 0.000 of 255 respectively,
  // the first two being the visible sibling alone at the rasterizer's own
  // 1/255 blend-rounding floor.
  {
    name: 'control-node2d-ancestor-transform',
    file: 'unit-control-node2d-ancestor-transform.tscn',
    mode: '2d',
  },
  {
    name: 'control-node2d-ancestor-hidden',
    file: 'unit-control-node2d-ancestor-hidden.tscn',
    mode: '2d',
  },
  {
    name: 'control-node2d-ancestor-modulate',
    file: 'unit-control-node2d-ancestor-modulate.tscn',
    mode: '2d',
  },
  // The ONE variable: which rect a promoted Control anchors against, one scene
  // per branch of `Control::get_parent_anchorable_rect`. Both are here because
  // the two branches are chosen by the same threading and a fix aimed at one
  // moves the other. The enclosing Panel is deliberately NOT full-rect, so
  // anchoring against it rather than the branch's own answer lands the box
  // somewhere else entirely. Measured against Godot 4.6.3 at `--mode 2d` before
  // their baselines were written: mean 0.006 of 255 each, the box alone at the
  // rasterizer's own 1/255 blend-rounding floor.
  {
    name: 'control-anchor-parent-node2d',
    file: 'unit-control-anchor-parent-node2d.tscn',
    mode: '2d',
  },
  {
    name: 'control-anchor-parent-plain-node',
    file: 'unit-control-anchor-parent-plain-node.tscn',
    mode: '2d',
  },
  // The ONE variable: a second coverage threshold on the glyph field, drawn
  // both as an outline around the fill and as an offset pass behind it. Every
  // other text scene draws the fill alone, so a threshold that lands on the
  // wrong side of the median is invisible in all of them. Measured against
  // Godot 4.6.3 at `--mode 2d` before its baseline was written: mean 0.372 of
  // 255, MSDF stem antialiasing along the outline edge.
  { name: 'label-outline', file: 'unit-label-outline.tscn', mode: '2d' },
  // The ONE variable: a control character reaching the shaper. Everywhere else
  // one advances zero and leaves no mark, so only a field that opts into the
  // hex box shows whether its geometry and its advance agree. Measured against
  // Godot 4.6.3 at `--mode 2d` before its baseline was written: mean 0.037 of
  // 255.
  {
    name: 'lineedit-control-chars',
    file: 'unit-lineedit-control-chars.tscn',
    mode: '2d',
  },
  // The ONE variable, one per scene: where a canvas ROOT sits. A CanvasItem
  // whose direct parent is not one, or that sets `top_level`, is parented at
  // the canvas rather than at its tree parent, which decides its transform, its
  // anchors, its tint and its place in the draw order at once. Both walks are
  // represented because the Control solve and the Node2D dispatch reach that
  // state through separate code, so a regression in one is invisible in the
  // other. Measured against Godot 4.6.3 at `--mode 2d` before their baselines
  // were written: 0.000 of 255 each.
  {
    name: 'control-detached-paint-order',
    file: 'unit-control-detached-paint-order.tscn',
    mode: '2d',
  },
  {
    name: 'control-top-level',
    file: 'unit-control-top-level.tscn',
    mode: '2d',
  },
  {
    name: 'control-in-parallax-background',
    file: 'unit-control-in-parallax-background.tscn',
    mode: '2d',
  },
  {
    name: 'node2d-detached-transform',
    file: 'unit-node2d-detached-transform.tscn',
    mode: '2d',
  },
  { name: 'node2d-top-level', file: 'unit-node2d-top-level.tscn', mode: '2d' },
  // GraphEdit's toolbar, minimap and scrollbars are built in its C++
  // constructor, so every scene below draws all three and each moves ONE
  // property on top of them. They are a family rather than one scene because
  // the chrome is the thing under test: a widget that stops being laid out is
  // invisible in the scene that hides it and obvious in the eight that do not.
  // Measured against Godot 4.6.3 at `--mode 2d` before their baselines were
  // written: 0.413 for the base scene and 0.53-0.77 of 255 for the rest, the
  // residual being cross-rasterizer text antialiasing in the zoom label.
  { name: 'graph-edit', file: 'unit-graph-edit.tscn', mode: '2d' },
  { name: 'graph-edit-menu-hidden', file: 'unit-graph-edit-menu-hidden.tscn', mode: '2d' },
  { name: 'graph-edit-zoom-label', file: 'unit-graph-edit-zoom-label.tscn', mode: '2d' },
  {
    name: 'graph-edit-zoom-buttons-hidden',
    file: 'unit-graph-edit-zoom-buttons-hidden.tscn',
    mode: '2d',
  },
  {
    name: 'graph-edit-grid-buttons-hidden',
    file: 'unit-graph-edit-grid-buttons-hidden.tscn',
    mode: '2d',
  },
  {
    name: 'graph-edit-minimap-button-hidden',
    file: 'unit-graph-edit-minimap-button-hidden.tscn',
    mode: '2d',
  },
  {
    name: 'graph-edit-arrange-button-hidden',
    file: 'unit-graph-edit-arrange-button-hidden.tscn',
    mode: '2d',
  },
  { name: 'graph-edit-minimap-disabled', file: 'unit-graph-edit-minimap-disabled.tscn', mode: '2d' },
  { name: 'graph-edit-minimap-size', file: 'unit-graph-edit-minimap-size.tscn', mode: '2d' },
  { name: 'graph-edit-minimap-opacity', file: 'unit-graph-edit-minimap-opacity.tscn', mode: '2d' },
  {
    name: 'graph-edit-minimap-connection',
    file: 'unit-graph-edit-minimap-connection.tscn',
    mode: '2d',
  },
  // The load-time clamps: `scroll_offset` against a still-zero bound and `zoom`
  // against whichever bound the file had applied by then. Both store a value
  // the scene never wrote, and neither is visible in a scene that omits them.
  {
    name: 'graph-edit-scroll-offset-clamped',
    file: 'unit-graph-edit-scroll-offset-clamped.tscn',
    mode: '2d',
  },
  { name: 'graph-edit-zoom-bound-order', file: 'unit-graph-edit-zoom-bound-order.tscn', mode: '2d' },
  // The ONE variable per scene: `layout_direction`. RTL both mirrors a Control's
  // own rect inside its parent (control.cpp:1785) and reverses a box
  // container's children (box_container.cpp:48) — two mechanisms one scene
  // cannot tell apart, so the bars have three different widths and the LTR row
  // sits above the RTL one. The second scene moves the flag on a CHILD of an
  // RTL Control, which is the only place the inherit climb is visible.
  // Measured against Godot 4.6.3 at `--mode 2d` before their baselines were
  // written: 0.017 and 0.000 of 255. The first residual is the two green bars
  // at max 1/255 — `0.7 x 255 = 178.5`, where Godot's own vulkan and opengl3
  // backends disagree with each other.
  {
    name: 'control-layout-direction-rtl',
    file: 'unit-control-layout-direction-rtl.tscn',
    mode: '2d',
  },
  {
    name: 'control-layout-direction-inherit',
    file: 'unit-control-layout-direction-inherit.tscn',
    mode: '2d',
  },
  // Every scene below pairs an LTR node with an otherwise identical RTL twin in
  // one frame, so a mirror that fails shows as the two halves disagreeing rather
  // than as a whole-frame shift. Each was measured against Godot 4.6.3 at
  // `--mode 2d` before its baseline was written, and each was checked band by
  // band: the LTR and RTL residuals are the same size, which a 1px misplacement
  // on one side would break. `layout_direction` reaches a widget's internal
  // arrangement, which is why one container scene cannot stand in for the rest.
  { name: 'grid-container-rtl', file: 'unit-grid-container-rtl.tscn', mode: '2d' },
  { name: 'flow-container-rtl', file: 'unit-flow-container-rtl.tscn', mode: '2d' },
  { name: 'flow-container-rtl-reverse-fill', file: 'unit-flow-container-rtl-reverse-fill.tscn', mode: '2d' },
  { name: 'aspect-ratio-container-rtl', file: 'unit-aspect-ratio-container-rtl.tscn', mode: '2d' },
  { name: 'margin-container-rtl', file: 'unit-margin-container-rtl.tscn', mode: '2d' },
  { name: 'split-container-rtl', file: 'unit-split-container-rtl.tscn', mode: '2d' },
  { name: 'scroll-container-rtl', file: 'unit-scroll-container-rtl.tscn', mode: '2d' },
  { name: 'foldable-container-rtl', file: 'unit-foldable-container-rtl.tscn', mode: '2d' },
  { name: 'tab-bar-rtl', file: 'unit-tab-bar-rtl.tscn', mode: '2d' },
  { name: 'tab-bar-rtl-scroll', file: 'unit-tab-bar-rtl-scroll.tscn', mode: '2d' },
  { name: 'tab-container-rtl', file: 'unit-tab-container-rtl.tscn', mode: '2d' },
  { name: 'menu-bar-rtl', file: 'unit-menu-bar-rtl.tscn', mode: '2d' },
  // The button family mirrors an icon side and a stylebox key, not a rect, so
  // each type needs its own scene: CheckBox and CheckButton swap which edge the
  // check sits on, OptionButton its arrow, LinkButton its text origin.
  { name: 'button-rtl', file: 'unit-button-rtl.tscn', mode: '2d' },
  { name: 'checkbox-rtl', file: 'unit-checkbox-rtl.tscn', mode: '2d' },
  { name: 'check-button-rtl', file: 'unit-check-button-rtl.tscn', mode: '2d' },
  { name: 'optionbutton-rtl', file: 'unit-optionbutton-rtl.tscn', mode: '2d' },
  { name: 'link-button-rtl', file: 'unit-link-button-rtl.tscn', mode: '2d' },
  // The text family places runs on the resolved direction without reordering
  // them. Two of these pin an ABSENCE — Godot does NOT mirror a FILL label or a
  // RichTextLabel line, because those arms read the paragraph direction, which
  // is dead at `text_direction`'s AUTO default. They guard against re-adding a
  // mirror the engine does not have.
  { name: 'label-rtl-alignment', file: 'unit-label-rtl-alignment.tscn', mode: '2d' },
  { name: 'label-rtl-fill-autowrap', file: 'unit-label-rtl-fill-autowrap.tscn', mode: '2d' },
  { name: 'label-rtl-visible-chars-auto', file: 'unit-label-rtl-visible-chars-auto.tscn', mode: '2d' },
  { name: 'line-edit-rtl', file: 'unit-line-edit-rtl.tscn', mode: '2d' },
  { name: 'text-edit-rtl', file: 'unit-text-edit-rtl.tscn', mode: '2d' },
  { name: 'code-edit-rtl', file: 'unit-code-edit-rtl.tscn', mode: '2d' },
  { name: 'rich-text-label-rtl', file: 'unit-rich-text-label-rtl.tscn', mode: '2d' },
  { name: 'spin-box-rtl', file: 'unit-spin-box-rtl.tscn', mode: '2d' },
  // Lists, ranges and the picker. The Tree scene is 100px wide on purpose: the
  // column division leaves a remainder there, and a width that divides evenly
  // makes the RTL row identical to the LTR one and proves nothing.
  { name: 'item-list-rtl', file: 'unit-item-list-rtl.tscn', mode: '2d' },
  { name: 'item-list-rtl-icon-top', file: 'unit-item-list-rtl-icon-top.tscn', mode: '2d' },
  { name: 'tree-rtl', file: 'unit-tree-rtl.tscn', mode: '2d' },
  { name: 'hslider-rtl', file: 'unit-hslider-rtl.tscn', mode: '2d' },
  { name: 'progress-bar-rtl', file: 'unit-progress-bar-rtl.tscn', mode: '2d' },
  { name: 'color-picker-rtl', file: 'unit-color-picker-rtl.tscn', mode: '2d' },
  // Two LTR alignment scenes, both from defects found while porting RTL. The
  // fractional-box one needs a NON-integer box width: at a whole width the
  // ceiled and raw line extents give the same offset, so it would prove nothing.
  { name: 'rich-text-label-center-overflow', file: 'unit-rich-text-label-center-overflow.tscn', mode: '2d' },
  { name: 'rich-text-label-fractional-box', file: 'unit-rich-text-label-fractional-box.tscn', mode: '2d' },
];
