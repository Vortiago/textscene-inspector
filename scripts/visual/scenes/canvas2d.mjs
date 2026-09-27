/**
 * The 2D canvas: polygons and lines, y-sorting, the PointLight2D surface with
 * its cull masks and occluder shadows, CPUParticles2D, 2D navigation and
 * parallax.
 */

export const CANVAS_2D_SCENES = [
  { name: 'polygon-2d', file: 'unit-polygon2d.tscn', mode: '2d' },
  { name: 'line-2d', file: 'unit-line2d.tscn', mode: '2d' },
  // A y-sorted node's own body, between the two children it merges into the
  // same sort. Godot probes: (200,330) yellow, the bar over the red block, and
  // (700,330) blue, the blue block over the bar. Without the body the first is
  // red, which no other golden notices.
  { name: 'ysort-own-body', file: 'unit-ysort-own-body.tscn', mode: '2d' },
  // The 2D light surface: ADD/SUB/MIX applied against a lit surface, and an
  // inline gradient cookie under a canvas tint with an unshaded item beside it.
  { name: 'pointlight2d-blend', file: 'unit-pointlight2d-blend.tscn', mode: '2d' },
  { name: 'pointlight2d-gradient', file: 'unit-pointlight2d-gradient.tscn', mode: '2d' },
  { name: 'pointlight2d-lightonly', file: 'unit-pointlight2d-lightonly.tscn', mode: '2d' },
  // Godot's light culling: `light.range_item_cull_mask & item.light_mask != 0`.
  // Four panels under two lights take the warm light, the cool one, both, and
  // neither, the last right under the cool light. No other golden sets either
  // mask, so a light that reached everything moves no other baseline.
  { name: 'pointlight2d-cull-mask', file: 'unit-pointlight2d-cull-mask.tscn', mode: '2d' },
  // The two range windows of the same cull test. `range_z_max = 4` over z_index
  // 0, 4 and 5 pins the per-item z window and its inclusive top. A default light
  // over a world panel and a bare CanvasLayer panel pins the per-canvas layer
  // window, whose 0..0 default is why Godot never lights an untouched HUD.
  { name: 'pointlight2d-range-z', file: 'unit-pointlight2d-range-z.tscn', mode: '2d' },
  { name: 'pointlight2d-range-layer', file: 'unit-pointlight2d-range-layer.tscn', mode: '2d' },
  // LightOccluder2D shadows, one behaviour per fixture. A shadow withholds a
  // light from the geometry behind the occluder; it never darkens what the
  // light did not reach, so an unlit surface is the same grey either way.
  { name: 'lightoccluder2d-shadow-closed', file: 'unit-lightoccluder2d-shadow-closed.tscn', mode: '2d' },
  // `unit-lightoccluder2d-shadow` is the single-edge case the LightOccluder2D
  // sheet leads with.
  { name: 'lightoccluder2d', file: 'unit-lightoccluder2d.tscn', mode: '2d' },
  { name: 'lightoccluder2d-shadow', file: 'unit-lightoccluder2d-shadow.tscn', mode: '2d' },
  // `cull_mode` 0/1/2: which winding of an occluder's edges casts. The reversed
  // pair winds the polygons the other way, so CLOCKWISE and COUNTER_CLOCKWISE
  // swap and DISABLED stays put. A winding-blind cull test leaves one of the two
  // baselines flat.
  { name: 'lightoccluder2d-cull-mode', file: 'unit-lightoccluder2d-cull-mode.tscn', mode: '2d' },
  { name: 'lightoccluder2d-cull-mode-reversed', file: 'unit-lightoccluder2d-cull-mode-reversed.tscn', mode: '2d' },
  // `shadow_color` is the light's, not the occluder's, and it replaces the light
  // term rather than withholding it. Godot does not multiply it by the item's
  // albedo, so it rides its own accumulator: folded into the ordinary one, it
  // sits a whole albedo out.
  { name: 'lightoccluder2d-shadow-color', file: 'unit-lightoccluder2d-shadow-color.tscn', mode: '2d' },
  // `shadow_item_cull_mask & occluder.light_mask`: one occluder casts, its twin
  // is culled by the same light.
  { name: 'lightoccluder2d-shadow-mask', file: 'unit-lightoccluder2d-shadow-mask.tscn', mode: '2d' },
  // Two shadowed lights in one accumulation pass: each must clear the stencil
  // before it stamps, or the first light's volume also cuts the second's.
  { name: 'lightoccluder2d-two-lights', file: 'unit-lightoccluder2d-two-lights.tscn', mode: '2d' },
  // `shadow_filter`, which every occluder fixture above leaves at NONE, gives a stepped penumbra.
  // The occluder's top sits at the light's y, so a vertical probe crosses the umbra edge square on.
  // Godot 4.6.3 transect at x=676: 167 / 129 / 100 / 80 / 67 / 63 of 255, the five PCF5 levels
  // under the (1-s)^2 falloff, with step boundaries 19.4 px either side of the geometric edge.
  { name: 'pointlight2d-shadow-pcf5', file: 'unit-pointlight2d-shadow-pcf5.tscn', mode: '2d' },
  // PCF13 spreads the same ramp over the wider kernel.
  { name: 'pointlight2d-shadow-pcf13', file: 'unit-pointlight2d-shadow-pcf13.tscn', mode: '2d' },
  // The colour fixture pins the fractional tint the two accumulators split.
  { name: 'pointlight2d-shadow-pcf-color', file: 'unit-pointlight2d-shadow-pcf-color.tscn', mode: '2d' },
  // CPUParticles2D renders a frozen pose: a live emitter never gives two
  // identical frames, so the harness fails it as unstable, not as changed. Each
  // fixture pins `use_fixed_seed`/`seed`/`fixed_fps`/`preprocess` so the pose
  // is one exact draw.
  { name: 'cpuparticles2d', file: 'unit-cpuparticles2d.tscn', mode: '2d' },
  { name: 'cpuparticles2d-emission-shapes', file: 'unit-cpuparticles2d-emission-shapes.tscn', mode: '2d' },
  { name: 'cpuparticles2d-curves', file: 'unit-cpuparticles2d-curves.tscn', mode: '2d' },
  { name: 'cpuparticles2d-color-ramp', file: 'unit-cpuparticles2d-color-ramp.tscn', mode: '2d' },
  // A scaled emitter whose particles must not scale with it: Godot's default
  // `local_coords = false` emits into world space.
  { name: 'cpuparticles2d-local-coords', file: 'unit-cpuparticles2d-local-coords.tscn', mode: '2d' },
  // `emitting = false` draws nothing. Script-triggered one-shot emitters ship
  // this way, so a regression that started drawing them would be widespread.
  { name: 'cpuparticles2d-not-emitting', file: 'unit-cpuparticles2d-not-emitting.tscn', mode: '2d' },
  // A NavigationPolygon's vertices are Godot canvas pixels (+Y down). Without
  // the negation, the navmesh draws above the region origin instead of below.
  { name: 'navigation-region-2d', file: 'unit-navigation-region-2d.tscn', mode: '2d' },
  // A ParallaxBackground is a CanvasLayer: its subtree hangs off the viewport,
  // so the blue bar stays at the canvas origin while the red reference bar moves
  // with the displaced parent. Every other 2D golden composes transforms the
  // ordinary way.
  { name: 'parallax-background', file: 'unit-parallax-background.tscn', mode: '2d' },
  // `motion_mirroring` draws the layer a second time, 200 px right: the only
  // repeated canvas subtree, and the only ParallaxLayer property a camera-less
  // still frame shows.
  { name: 'parallax-layer', file: 'unit-parallax-layer.tscn', mode: '2d' },
  // The one emitter with no `preprocess`, so the previewer substitutes its
  // instant. Its lifetime is not a multiple of the step, so the settle's
  // whole-frame overshoot is in the picture. Compare with Godot through
  // `--particles 0.95`, the command in the fixture header.
  { name: 'cpuparticles2d-unpreprocessed', file: 'unit-cpuparticles2d-unpreprocessed.tscn', mode: '2d' },
  // The one emitter that does not pin its seed, so it exercises the substituted
  // one. Godot cannot draw this scene the same way twice. The previewer must,
  // and this baseline records our pose, which no reference can arbitrate.
  { name: 'cpuparticles2d-unseeded', file: 'unit-cpuparticles2d-unseeded.tscn', mode: '2d' },
  // The one variable: a Sprite2D that magnifies its texture. Every other sprite
  // scene draws at 1:1, where a bilinear filter never blends two texels.
  // Godot's 64px ramp across a black/white edge is linear in the encoded bytes:
  // rgb(129) at the midpoint, against 189 for decode-before-filter.
  { name: 'sprite2d-magnified', file: 'unit-sprite2d-magnified.tscn', mode: '2d' },
  // A Sprite2D whose `texture` is an inline GradientTexture2D, rasterised out of
  // the scene. Every other sprite scene points at an image, so only this one
  // loses its quad to a placeholder when the procedural branch breaks.
  {
    name: 'sprite2d-gradienttexture',
    file: 'unit-sprite2d-gradienttexture.tscn',
    mode: '2d',
  },
  // Native Control rendering (ADR-0037): Controls draw into the WebGL canvas
  // like every other 2D item, captured in a 1:1 frame with no camera fit. Each
  // scene below moves one piece of that renderer. Its fixture header says which
  // and records the Godot 4.6.3 `--mode 2d` probes of its baseline.
  { name: 'vbox-container-pitch', file: 'unit-vbox-container-pitch.tscn', mode: '2d' },
  { name: 'panel-styleboxes', file: 'unit-panel-styleboxes.tscn', mode: '2d' },
  // The one variable: the whole-pass stages of `StyleBoxFlat::draw`. `skew`
  // shears the box without moving it and turns anti-aliasing on by itself. The drop shadow draws
  // before everything else. Neither changes a radius or a border width, so no
  // other stylebox scene sees them.
  { name: 'panel-stylebox-skew-shadow', file: 'unit-panel-stylebox-skew-shadow.tscn', mode: '2d' },
  { name: 'label-wrap', file: 'unit-label-2d-wrap.tscn', mode: '2d' },
  // The one variable: `vertical_alignment`. Every other Label is V_TOP, where
  // the offset is zero and Godot's int conversion of it is a no-op, so nothing
  // else draws the CENTER/BOTTOM/FILL branches.
  { name: 'label-valign', file: 'unit-label-2d-valign.tscn', mode: '2d' },
  // The one variable: a Theme `.tres`'s `default_font`/`default_font_size`, set
  // through `theme =` on the root Control. Two Labels with no font override, one
  // two hops down past a themeless Control, resolve it by the ancestor walk.
  // Every other Control golden draws the bundled MSDF atlas.
  { name: 'control-scene-font-theme', file: 'unit-control-scene-font-theme.tscn', mode: '2d' },
  // The one variable: a `.woff2` font takes the ascent/descent fallback.
  // `sfntTables.ts` cannot parse Brotli-compressed WOFF2, so the metrics come
  // from `TextMetrics.fontBoundingBoxAscent`/`.fontBoundingBoxDescent`. No
  // same-face `.woff2`/`.otf` pair exists, so compare with Godot, not the sibling.
  { name: 'control-scene-font-woff2', file: 'unit-control-scene-font-woff2.tscn', mode: '2d' },
  // The one variable: a scene font drawn magnified. At 1x no filter kernel runs,
  // so only a scaled Label shows the sampling colour space of the canvas-painted
  // glyph texture. The fixture header settles which space is correct.
  {
    name: 'control-scene-font-magnified',
    file: 'unit-control-scene-font-magnified.tscn',
    mode: '2d',
  },
  // RichTextLabel's supported bbcode subset in one pass: bold by embolden,
  // italic by skew, the underline rule and a colour span. The styled runs keep a
  // sub-pixel vertical residual against Godot, a FreeType light-hinting limit
  // the slice's sheet records. A span-layout change moves them here.
  { name: 'richtext-label-bbcode', file: 'unit-rich-text-label.tscn', mode: '2d' },
  { name: 'button-states', file: 'unit-button-states.tscn', mode: '2d' },
  // The one variable: `anchors_preset` with no `anchor_*` and no `layout_mode`,
  // where Godot's setter does nothing. An editor-saved scene always writes the
  // matching `anchor_*`, so no other scene reaches this path.
  {
    name: 'control-anchors-preset-gate',
    file: 'unit-control-anchors-preset-gate.tscn',
    mode: '2d',
  },
  // The preset's offset side effect, in the one shape that survives the
  // minimum-size floor: an authored `grow_*` that contradicts the preset, so the
  // rewritten offsets are not a fixed point.
  {
    name: 'control-anchors-preset-offsets',
    file: 'unit-control-anchors-preset-offsets.tscn',
    mode: '2d',
  },
  // The one variable: a default-theme icon drawn magnified. The icons have their
  // own loader, and every other scene draws them at natural size. Godot's ramp
  // at the checked icon's left edge dips to rgb(72), below the 76 backdrop,
  // which only a blend of the encoded bytes produces.
  {
    name: 'checkbox-icon-magnified',
    file: 'unit-checkbox-icon-magnified.tscn',
    mode: '2d',
  },
  // A TextureRect and a Button icon fed by an inline GradientTexture2D. The
  // texture drives each node's minimum size as well as its pixels, so the
  // sibling below moves too: these report a layout regression as well.
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
  // Three TextureRects fed by inline AtlasTextures from one four-colour sheet.
  // Each rect shrinks to its region, so a wrong region shows as a wrong rect and
  // moves the sibling below. The third cell's `margin` widens the reported box
  // and insets the region inside it.
  {
    name: 'texturerect-atlastexture',
    file: 'unit-texturerect-atlastexture.tscn',
    mode: '2d',
  },
  // The one variable: the texture_filter ancestor walk. Three TextureRects on an
  // 8x8 checkerboard at 25x name no filter. The left two inherit NEAREST, one
  // past a PARENT_NODE parent. The right one keeps the viewport's LINEAR. No
  // other TextureRect scene puts a naming ancestor above an inheriting one.
  {
    name: 'texturerect-filter-inherit',
    file: 'unit-texture-rect-filter-inherit.tscn',
    mode: '2d',
  },
  // The same atlas decode reached through SpriteFrames. It shares the decode but
  // not the resource pools, so the atlas entry can pass while this one draws
  // nothing.
  {
    name: 'animatedsprite2d-atlas',
    file: 'unit-animatedsprite2d-atlas.tscn',
    mode: '2d',
  },
  { name: 'scroll-container-clip', file: 'unit-scroll-container-clip.tscn', mode: '2d' },
  // The two SubViewportContainer surfaces. A mesh-sampled SubViewport
  // (`sub-viewport-texture`) is a different consumer. `-controls` holds Controls,
  // drawn live even when no pixel leaves a render target. Godot 4.6.3
  // `--mode 2d`: pixel-identical over the whole frame.
  { name: 'sub-viewport-container-controls', file: 'unit-sub-viewport-container.tscn', mode: '2d' },
  // `-2d-content` holds Polygon2Ds, which reach the container only as the
  // offscreen pass's published texture. Godot 4.6.3 `--mode 2d`: within 1/255,
  // the 8-bit linear intermediate the SubViewportContainer sheet documents.
  {
    name: 'sub-viewport-container-2d-content',
    file: 'unit-sub-viewport-container-2d-content.tscn',
    mode: '2d',
  },
  // The container takes its rect from a size-consuming parent, so its minimum
  // size is load-bearing. At the scene origin, a rect solved half its size off
  // looks the same as an authored one.
  {
    name: 'sub-viewport-container-centred',
    file: 'unit-sub-viewport-container-centred.tscn',
    mode: '2d',
  },
  // The one variable: a Label that autowraps inside a container that sizes to
  // it. `label-wrap` sets authored widths with no parent to be wrong against.
  // Here the card's own height is the measurement.
  {
    name: 'label-autowrap-in-container',
    file: 'unit-label-autowrap-in-container.tscn',
    mode: '2d',
  },
  // The one variable: a ScrollContainer whose bar rects land on a fraction.
  // `scroll-container-clip` has whole-number bar origins, where the
  // per-canvas-item snap is a no-op.
  {
    name: 'scroll-container-bar-snap',
    file: 'unit-scroll-container-bar-snap.tscn',
    mode: '2d',
  },
  // The one variable: a canvas clip whose position and size round separately.
  // A scaled ancestor gives a fractional origin, the only place that differs
  // from one edge rounding. Godot 4.6.3 `--mode 2d`: pixel-identical over the
  // whole frame.
  {
    name: 'scroll-container-clip-quantize',
    file: 'unit-scroll-container-clip-quantize.tscn',
    mode: '2d',
  },
  // The composition scene breaks the one-variable rule on purpose: it catches
  // interactions a single-variable scene has nothing to interact with. The
  // `unit-*` fixture of a type localises a regression. Text-dense, so MSDF stem
  // antialiasing dominates its diff.
  { name: 'complex-2d-gui', file: 'complex-2d-gui.tscn', mode: '2d' },
  // The one variable: whether an ancestor's `modulate` crosses a CanvasLayer.
  // The Control walk and the Node2D dispatch publish that scope separately, so
  // both families are here. Godot 4.6.3 `--mode 2d`: in-layer squares read
  // rgb(255,255,255), the outside ones rgb(64,64,64), on both sides.
  {
    name: 'canvas-layer-modulate-scope',
    file: 'unit-canvas-layer-modulate-scope.tscn',
    mode: '2d',
  },
  // The one variable: a Control promoted past a non-Control ancestor, one facet
  // per scene. The walk resets the whole chain at a broken CanvasItem link, so
  // a fix to one facet can move another. Godot 4.6.3 `--mode 2d`: mean 0.001,
  // 0.006 and 0.000 of 255, the 1/255 blend-rounding floor.
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
  // The one variable: which rect a promoted Control anchors against, one scene
  // per branch of `Control::get_parent_anchorable_rect`, both picked by the same
  // threading. The Panel is not full-rect, so a wrong anchor moves the box.
  // Godot 4.6.3 `--mode 2d`: mean 0.006 of 255 each, the 1/255 rounding floor.
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
  // The one variable: a second coverage threshold on the glyph field, drawn as
  // an outline and as an offset pass behind the fill. Other text scenes draw the
  // fill alone. Godot 4.6.3 `--mode 2d`: mean 0.372 of 255, MSDF stem
  // antialiasing along the outline edge.
  { name: 'label-outline', file: 'unit-label-outline.tscn', mode: '2d' },
  // The one variable: a control character reaching the shaper. Elsewhere it
  // advances zero, so only a field that opts into the hex box shows whether its
  // geometry and its advance agree. Godot 4.6.3 `--mode 2d`: mean 0.037 of 255.
  {
    name: 'lineedit-control-chars',
    file: 'unit-lineedit-control-chars.tscn',
    mode: '2d',
  },
  // The one variable: where a canvas root sits. A CanvasItem under a non-canvas
  // parent, or with `top_level`, parents at the canvas, which sets its transform,
  // anchors, tint and draw order. The Control and Node2D walks reach it
  // separately. Godot 4.6.3 `--mode 2d`: 0.000 of 255 each.
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
  // GraphEdit's constructor builds its toolbar, minimap and scrollbars, so each
  // scene draws all three and moves one property. A widget that stops laying out
  // shows in each scene that does not hide it. Godot 4.6.3 `--mode 2d`: 0.413 and
  // 0.53-0.77 of 255, cross-rasterizer text antialiasing in the zoom label.
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
  // `layout_direction`: RTL mirrors a Control's rect in its parent
  // (control.cpp:1785) and reverses box children (box_container.cpp:48), so three
  // bar widths, LTR row above RTL. Godot 4.6.3: 0.017 of 255, green bars at
  // `0.7 x 255 = 178.5`, which vulkan and opengl3 round apart.
  {
    name: 'control-layout-direction-rtl',
    file: 'unit-control-layout-direction-rtl.tscn',
    mode: '2d',
  },
  // The flag on a child of an RTL Control, the one place the inherit climb
  // shows. Godot 4.6.3 `--mode 2d`: 0.000 of 255.
  {
    name: 'control-layout-direction-inherit',
    file: 'unit-control-layout-direction-inherit.tscn',
    mode: '2d',
  },
  // Each scene below pairs an LTR node with an identical RTL twin, so a failed
  // mirror shows as the halves disagreeing. Against Godot 4.6.3 the residuals
  // match band by band, which a 1px shift on one side breaks. `layout_direction`
  // reaches each widget's own arrangement, so no scene stands in for the rest.
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
  // A font-size override is the one theme item a TabBar shapes every tab
  // against, and the shaped buffer sizes the strip as well as the glyphs, so
  // the TabContainer half also moves its content band. Every other tab scene
  // resolves the default, where a strip measured at the wrong rung looks right.
  { name: 'tab-font-size-override', file: 'unit-tab-font-size-override.tscn', mode: '2d' },
  // The button family mirrors an icon side and a stylebox key, not a rect, so
  // each type needs its own scene: CheckBox and CheckButton swap which edge the
  // check sits on, OptionButton its arrow, LinkButton its text origin.
  { name: 'button-rtl', file: 'unit-button-rtl.tscn', mode: '2d' },
  { name: 'checkbox-rtl', file: 'unit-checkbox-rtl.tscn', mode: '2d' },
  { name: 'check-button-rtl', file: 'unit-check-button-rtl.tscn', mode: '2d' },
  { name: 'optionbutton-rtl', file: 'unit-optionbutton-rtl.tscn', mode: '2d' },
  { name: 'link-button-rtl', file: 'unit-link-button-rtl.tscn', mode: '2d' },
  // The text family places runs on the resolved direction without reordering
  // them. Two pin an absence: Godot does not mirror a FILL label or a
  // RichTextLabel line, since those arms read the paragraph direction, dead at
  // `text_direction`'s AUTO default.
  { name: 'label-rtl-alignment', file: 'unit-label-rtl-alignment.tscn', mode: '2d' },
  { name: 'label-rtl-fill-autowrap', file: 'unit-label-rtl-fill-autowrap.tscn', mode: '2d' },
  { name: 'label-rtl-visible-chars-auto', file: 'unit-label-rtl-visible-chars-auto.tscn', mode: '2d' },
  { name: 'line-edit-rtl', file: 'unit-line-edit-rtl.tscn', mode: '2d' },
  { name: 'text-edit-rtl', file: 'unit-text-edit-rtl.tscn', mode: '2d' },
  { name: 'code-edit-rtl', file: 'unit-code-edit-rtl.tscn', mode: '2d' },
  { name: 'rich-text-label-rtl', file: 'unit-rich-text-label-rtl.tscn', mode: '2d' },
  { name: 'spin-box-rtl', file: 'unit-spin-box-rtl.tscn', mode: '2d' },
  // Lists, ranges and the picker. The Tree scene is 100px wide so the column
  // division leaves a remainder: an even width makes the RTL row match the LTR.
  { name: 'item-list-rtl', file: 'unit-item-list-rtl.tscn', mode: '2d' },
  { name: 'item-list-rtl-icon-top', file: 'unit-item-list-rtl-icon-top.tscn', mode: '2d' },
  { name: 'tree-rtl', file: 'unit-tree-rtl.tscn', mode: '2d' },
  { name: 'hslider-rtl', file: 'unit-hslider-rtl.tscn', mode: '2d' },
  { name: 'progress-bar-rtl', file: 'unit-progress-bar-rtl.tscn', mode: '2d' },
  { name: 'color-picker-rtl', file: 'unit-color-picker-rtl.tscn', mode: '2d' },
  // Two LTR alignment scenes. The fractional-box one needs a non-integer box
  // width: at a whole width the ceiled and raw line extents give one offset.
  { name: 'rich-text-label-center-overflow', file: 'unit-rich-text-label-center-overflow.tscn', mode: '2d' },
  { name: 'rich-text-label-fractional-box', file: 'unit-rich-text-label-fractional-box.tscn', mode: '2d' },
  // Each scene below moves one property no other scene authors. Godot 4.6.3
  // `--mode 2d`: 0.005 to 0.342 of 255.

  // The focus StyleBox's margins: the border itself needs focus.
  {
    name: 'scroll-container-focus-border',
    file: 'unit-scroll-container-focus-border.tscn',
    mode: '2d',
  },
  // The overflow hint quads.
  {
    name: 'scroll-container-scroll-hint',
    file: 'unit-scroll-container-scroll-hint.tscn',
    mode: '2d',
  },
  // An N-child split's own offsets.
  { name: 'split-container-offsets', file: 'unit-split-container-offsets.tscn', mode: '2d' },
  // The caret an `editable = false` field still draws.
  { name: 'text-edit-caret-readonly', file: 'unit-text-edit-caret-readonly.tscn', mode: '2d' },
  // A wrapped row's step-in.
  { name: 'text-edit-indent-wrapped', file: 'unit-text-edit-indent-wrapped.tscn', mode: '2d' },
  // The column rules.
  { name: 'code-edit-guidelines', file: 'unit-code-edit-guidelines.tscn', mode: '2d' },
  // The fold arrow the delimiter tables decide.
  { name: 'code-edit-delimiters', file: 'unit-code-edit-delimiters.tscn', mode: '2d' },
  // A Button label that wraps.
  { name: 'button-autowrap', file: 'unit-button-autowrap.tscn', mode: '2d' },
  // A Polygon2D below a plain Node below a hidden Node2D: its visibility comes from the Window.
  { name: 'canvas-root-visibility', file: 'unit-canvas-root-visibility.tscn', mode: '2d' },
];
