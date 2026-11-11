/** Control widgets: buttons, check boxes, tabs, item lists, graph nodes, colour pickers, progress bars, splits, spin boxes and scroll containers. */

export const CONTROL_WIDGET_SCENES = [
  // The one variable: `texture_filter` on the Node2D ancestor of a Control, read through the
  // vendored theme icon loader, which no other golden magnifies under an ancestor's filter.
  {
    name: 'checkbox-icon-texture-filter-inherited',
    file: 'unit-checkbox-icon-texture-filter-inherited.tscn',
  },
  // The one variable: a Theme `.tres`'s `default_font`/`default_font_size`, set
  // through `theme =` on the root Control. Two Labels with no font override, one
  // two hops down past a themeless Control, resolve it by the ancestor walk.
  // Every other Control golden draws the bundled MSDF atlas.
  { name: 'control-scene-font-theme', file: 'unit-control-scene-font-theme.tscn' },
  // The one variable: the arrows U+2190 to U+2193 from a scene font, as the bundled font has none.
  { name: 'control-font-arrows', file: 'unit-control-font-arrows.tscn' },
  // The one variable: a variable `.woff2` font drawn at its `fvar` defaults. Its metrics come
  // from its own tables, which `fontContainer.ts` decompresses. No same-face `.woff2`/`.otf`
  // pair exists, so compare with Godot, not the sibling.
  { name: 'control-scene-font-woff2', file: 'unit-control-scene-font-woff2.tscn' },
  // The one variable: a font whose OS/2 sets USE_TYPO_METRICS with typographic metrics that
  // differ from its `hhea`, which FreeType then ignores.
  {
    name: 'control-scene-font-typo-metrics',
    file: 'unit-control-scene-font-typo-metrics.tscn',
  },
  // The one variable: a scene font drawn magnified. At 1x no filter kernel runs,
  // so only a scaled Label shows the sampling colour space of the canvas-painted
  // glyph texture. The fixture header settles which space is correct.
  {
    name: 'control-scene-font-magnified',
    file: 'unit-control-scene-font-magnified.tscn',
  },
  // A ProgressBar percentage with an outline, over a plain, an emboldened, a sheared and an emboldened and sheared face.
  { name: 'progress-bar-outline-variation', file: 'unit-progress-bar-outline-variation.tscn' },
  // The one variable: `outline_size` of a bundled-font ProgressBar percentage, a ring stroked on the canvas painter.
  { name: 'progress-bar-bundled-outline', file: 'unit-progress-bar-bundled-outline.tscn' },
  // The one variable: the FontVariation of a ProgressBar percentage with no outline, so the fill alone draws.
  { name: 'progress-bar-embolden-fill', file: 'unit-progress-bar-embolden-fill.tscn' },
  // The one variable: the fractional width of a centred Button, whose text then sits off a whole item
  // pixel, which Godot floors.
  {
    name: 'button-fractional-text-origin',
    file: 'project-default-font/unit-button-fractional-text-origin.tscn',
  },
  { name: 'button-states', file: 'unit-button-states.tscn' },
  // The one variable: the theme text outline of Button, CheckBox, CheckButton, OptionButton and MenuButton.
  { name: 'button-family-outline', file: 'unit-button-family-outline.tscn' },
  // The one variable: a Theme item keyed on BaseButton, which a Button finds only by walking its
  // ClassDB chain. Every other themed golden keys its items on the node's own class.
  { name: 'control-theme-base-class', file: 'unit-control-theme-base-class.tscn' },
  // The one variable: `anchors_preset` with no `anchor_*` and no `layout_mode`,
  // where Godot's setter does nothing. An editor-saved scene always writes the
  // matching `anchor_*`, so no other scene reaches this path.
  {
    name: 'control-anchors-preset-gate',
    file: 'unit-control-anchors-preset-gate.tscn',
  },
  // The preset's offset side effect, in the one shape that survives the
  // minimum-size floor: an authored `grow_*` that contradicts the preset, so the
  // rewritten offsets are not a fixed point.
  {
    name: 'control-anchors-preset-offsets',
    file: 'unit-control-anchors-preset-offsets.tscn',
  },
  // The one variable: a default-theme icon drawn magnified. The icons have their
  // own loader, and every other scene draws them at natural size. Godot's ramp
  // at the checked icon's left edge dips to rgb(72), below the 76 backdrop,
  // which only a blend of the encoded bytes produces.
  {
    name: 'checkbox-icon-magnified',
    file: 'unit-checkbox-icon-magnified.tscn',
  },
  // The one variable: where a check icon lands off the whole pixel. A fitted
  // CheckBox icon keeps its fractional size, and a CheckButton centres on the
  // half pixel an odd height leaves. Rounding either moves its edge rows.
  { name: 'check-box-fitted-icon', file: 'unit-check-box-fitted-icon.tscn' },
  { name: 'check-button-half-pixel-icon', file: 'unit-check-button-half-pixel-icon.tscn' },
  {
    name: 'button-icon-gradienttexture',
    file: 'unit-button-icon-gradienttexture.tscn',
  },
  { name: 'scroll-container-clip', file: 'unit-scroll-container-clip.tscn' },
  // A PointLight2D lights native Controls like any CanvasItem. Godot 4.6.3 `--mode 2d`: (100,100)
  // rgb(168,120,81) the ColorRect, (500,100) rgb(67,120,81) the Panel, (300,140) rgb(255,159,92)
  // under the Torch.
  { name: 'control-light2d', file: 'unit-control-light2d.tscn' },
  // `light_mask` on a Control. Godot 4.6.3 `--mode 2d`: (200,200) rgb(153,107,61) lit, (600,200)
  // rgb(102,76,51) the Masked ColorRect at its authored colour.
  { name: 'control-light-mask', file: 'unit-control-light-mask.tscn' },
  // A CanvasModulate tints native Controls. Godot 4.6.3 `--mode 2d`: (100,100) rgb(82,92,92).
  { name: 'control-canvas-modulate', file: 'unit-control-canvas-modulate.tscn' },
  // A CanvasItemMaterial on a Control. Godot 4.6.3 `--mode 2d`: (100,100) rgb(204,102,51) unshaded,
  // (400,100) rgb(176,116,72) Light Only, (640,100) rgb(249,160,112) Add, (880,100) rgb(96,50,20) Mul.
  { name: 'control-canvas-item-material', file: 'unit-control-canvas-item-material.tscn' },
  // The one variable: a ScrollContainer whose bar rects land on a fraction.
  // `scroll-container-clip` has whole-number bar origins, where the
  // per-canvas-item snap is a no-op.
  {
    name: 'scroll-container-bar-snap',
    file: 'unit-scroll-container-bar-snap.tscn',
  },
  // The one variable: a canvas clip whose position and size round separately.
  // A scaled ancestor gives a fractional origin, the only place that differs
  // from one edge rounding. Godot 4.6.3 `--mode 2d`: pixel-identical over the
  // whole frame.
  {
    name: 'scroll-container-clip-quantize',
    file: 'unit-scroll-container-clip-quantize.tscn',
  },
  // The one variable: a Control promoted past a non-Control ancestor, one facet
  // per scene. The walk resets the whole chain at a broken CanvasItem link, so
  // a fix to one facet can move another. Godot 4.6.3 `--mode 2d`: mean 0.001,
  // 0.006 and 0.000 of 255, the 1/255 blend-rounding floor.
  {
    name: 'control-node2d-ancestor-transform',
    file: 'unit-control-node2d-ancestor-transform.tscn',
  },
  {
    name: 'control-node2d-ancestor-hidden',
    file: 'unit-control-node2d-ancestor-hidden.tscn',
  },
  {
    name: 'control-node2d-ancestor-modulate',
    file: 'unit-control-node2d-ancestor-modulate.tscn',
  },
  // The one variable: which rect a promoted Control anchors against, one scene
  // per branch of `Control::get_parent_anchorable_rect`, both picked by the same
  // threading. The Panel is not full-rect, so a wrong anchor moves the box.
  // Godot 4.6.3 `--mode 2d`: mean 0.006 of 255 each, the 1/255 rounding floor.
  {
    name: 'control-anchor-parent-node2d',
    file: 'unit-control-anchor-parent-node2d.tscn',
  },
  {
    name: 'control-anchor-parent-plain-node',
    file: 'unit-control-anchor-parent-plain-node.tscn',
  },
  // The one variable: where a canvas root sits. A CanvasItem under a non-canvas
  // parent, or with `top_level`, parents at the canvas, which sets its transform,
  // anchors, tint and draw order. The Control and Node2D walks reach it
  // separately. Godot 4.6.3 `--mode 2d`: 0.000 of 255 each.
  {
    name: 'control-detached-paint-order',
    file: 'unit-control-detached-paint-order.tscn',
  },
  {
    name: 'control-top-level',
    file: 'unit-control-top-level.tscn',
  },
  {
    name: 'control-in-parallax-background',
    file: 'unit-control-in-parallax-background.tscn',
  },
  // GraphEdit's constructor builds its toolbar, minimap and scrollbars, so each
  // scene draws all three and moves one property. A widget that stops laying out
  // shows in each scene that does not hide it. Godot 4.6.3 `--mode 2d`: 0.413 and
  // 0.53-0.77 of 255, cross-rasterizer text antialiasing in the zoom label.
  { name: 'graph-edit', file: 'unit-graph-edit.tscn' },
  { name: 'graph-edit-menu-hidden', file: 'unit-graph-edit-menu-hidden.tscn' },
  { name: 'graph-edit-zoom-label', file: 'unit-graph-edit-zoom-label.tscn' },
  {
    name: 'graph-edit-zoom-buttons-hidden',
    file: 'unit-graph-edit-zoom-buttons-hidden.tscn',
  },
  {
    name: 'graph-edit-grid-buttons-hidden',
    file: 'unit-graph-edit-grid-buttons-hidden.tscn',
  },
  {
    name: 'graph-edit-minimap-button-hidden',
    file: 'unit-graph-edit-minimap-button-hidden.tscn',
  },
  {
    name: 'graph-edit-arrange-button-hidden',
    file: 'unit-graph-edit-arrange-button-hidden.tscn',
  },
  { name: 'graph-edit-minimap-disabled', file: 'unit-graph-edit-minimap-disabled.tscn' },
  { name: 'graph-edit-minimap-size', file: 'unit-graph-edit-minimap-size.tscn' },
  { name: 'graph-edit-minimap-opacity', file: 'unit-graph-edit-minimap-opacity.tscn' },
  {
    name: 'graph-edit-minimap-connection',
    file: 'unit-graph-edit-minimap-connection.tscn',
  },
  {
    name: 'graph-edit-minimap-connection-origin',
    file: 'unit-graph-edit-minimap-connection-origin.tscn',
  },
  // The load-time clamps: `scroll_offset` against a still-zero bound and `zoom`
  // against whichever bound the file had applied by then. Both store a value
  // the scene never wrote, and neither is visible in a scene that omits them.
  {
    name: 'graph-edit-scroll-offset-clamped',
    file: 'unit-graph-edit-scroll-offset-clamped.tscn',
  },
  { name: 'graph-edit-zoom-bound-order', file: 'unit-graph-edit-zoom-bound-order.tscn' },
  // `layout_direction`: RTL mirrors a Control's rect in its parent
  // (control.cpp:1785) and reverses box children (box_container.cpp:48), so three
  // bar widths, LTR row above RTL. Godot 4.6.3: 0.017 of 255, green bars at
  // `0.7 x 255 = 178.5`, which vulkan and opengl3 round apart.
  {
    name: 'control-layout-direction-rtl',
    file: 'unit-control-layout-direction-rtl.tscn',
  },
  // The flag on a child of an RTL Control, the one place the inherit climb
  // shows. Godot 4.6.3 `--mode 2d`: 0.000 of 255.
  {
    name: 'control-layout-direction-inherit',
    file: 'unit-control-layout-direction-inherit.tscn',
  },
  { name: 'split-container-rtl', file: 'unit-split-container-rtl.tscn' },
  { name: 'scroll-container-rtl', file: 'unit-scroll-container-rtl.tscn' },
  { name: 'tab-bar-rtl', file: 'unit-tab-bar-rtl.tscn' },
  { name: 'tab-bar-rtl-scroll', file: 'unit-tab-bar-rtl-scroll.tscn' },
  { name: 'tab-container-rtl', file: 'unit-tab-container-rtl.tscn' },
  // A font-size override is the one theme item a TabBar shapes every tab
  // against, and the shaped buffer sizes the strip as well as the glyphs, so
  // the TabContainer half also moves its content band. Every other tab scene
  // resolves the default, where a strip measured at the wrong rung looks right.
  { name: 'tab-font-size-override', file: 'unit-tab-font-size-override.tscn' },
  // The button family mirrors an icon side and a stylebox key, not a rect, so
  // each type needs its own scene: CheckBox and CheckButton swap which edge the
  // check sits on, OptionButton its arrow, LinkButton its text origin.
  { name: 'button-rtl', file: 'unit-button-rtl.tscn' },
  { name: 'checkbox-rtl', file: 'unit-checkbox-rtl.tscn' },
  { name: 'check-button-rtl', file: 'unit-check-button-rtl.tscn' },
  { name: 'spin-box-rtl', file: 'unit-spin-box-rtl.tscn' },
  // Each text Control's own paragraph direction, language and structured override, as the label-bidi
  // scenes hold them for a Label: the button family, the editors, RichTextLabel paragraphs, the
  // TabBar, MenuBar and FoldableContainer titles, and ItemList items.
  { name: 'button-text-direction', file: 'unit-button-text-direction.tscn' },
  { name: 'item-list-text-direction', file: 'unit-item-list-text-direction.tscn' },
  // Lists, ranges and the picker. The Tree scene is 100px wide so the column
  // division leaves a remainder: an even width makes the RTL row match the LTR.
  { name: 'item-list-rtl', file: 'unit-item-list-rtl.tscn' },
  { name: 'item-list-rtl-icon-top', file: 'unit-item-list-rtl-icon-top.tscn' },
  { name: 'progress-bar-rtl', file: 'unit-progress-bar-rtl.tscn' },
  { name: 'color-picker-rtl', file: 'unit-color-picker-rtl.tscn' },
  { name: 'spin-box-direction', file: 'numeral-locale/unit-spin-box-direction.tscn' },
  // This scene moves one property no other scene authors. Godot 4.6.3
  // `--mode 2d`: 0.005 to 0.342 of 255.
  // The focus StyleBox's margins: the border itself needs focus.
  {
    name: 'scroll-container-focus-border',
    file: 'unit-scroll-container-focus-border.tscn',
  },
  // The overflow hint quads.
  {
    name: 'scroll-container-scroll-hint',
    file: 'unit-scroll-container-scroll-hint.tscn',
  },
  // An N-child split's own offsets.
  { name: 'split-container-offsets', file: 'unit-split-container-offsets.tscn' },
  // A Button label that wraps.
  { name: 'button-autowrap', file: 'unit-button-autowrap.tscn' },
  // `z_as_relative = false` on a Control. Godot 4.6.3 `--mode 2d`: the amber ColorRect draws under
  // the teal one (z 1 against 3), and its Panel parent (z 5) over both. Mean 0.805/255 against it,
  // all from the default clear 0.3 at the half step 76.5 (Godot 76, ours 77). Item pixels match.
  { name: 'control-z-as-relative', file: 'unit-control-z-as-relative.tscn', mode: '2d' },
  { name: 'graph-edit-frame-order', file: 'unit-graph-edit-frame-order.tscn', mode: '2d' },
  { name: 'graph-edit-zoom-out', file: 'unit-graph-edit-zoom-out.tscn', mode: '2d' },
  { name: 'graph-edit-zoom-in', file: 'unit-graph-edit-zoom-in.tscn', mode: '2d' },
  { name: 'button-expand-icon-no-room', file: 'unit-button-expand-icon-no-room.tscn', mode: '2d' },
  { name: 'button-icon-zero-size', file: 'unit-button-icon-zero-size.tscn', mode: '2d' },
  { name: 'item-list-wrap-trim', file: 'unit-item-list-wrap-trim.tscn', mode: '2d' },
  { name: 'item-list-scroll', file: 'unit-item-list-scroll.tscn', mode: '2d' },
  // The one variable is `color_mode = 1` (HSV rainbow row) and, in the second scene, an HDR `color`
  // (the `script` icon of `text_type`).
  { name: 'color-picker-hsv-rows', file: 'unit-color-picker-hsv-rows.tscn', mode: '2d' },
  { name: 'color-picker-hdr-hex', file: 'unit-color-picker-hdr-hex.tscn', mode: '2d' },
  // The one variable is an ancestor Theme that sets the font colours of Label, Button and LineEdit.
  { name: 'color-picker-theme', file: 'unit-color-picker-theme.tscn', mode: '2d' },
  // The one variable is a FlatMenuButton box that the shape, mode and menu buttons draw and size by.
  { name: 'color-picker-flat-menu-button', file: 'unit-color-picker-flat-menu-button.tscn', mode: '2d' },
  // The one variable is a TabContainer tab_selected box that the pressed mode button reads.
  { name: 'color-picker-mode-button-margins', file: 'unit-color-picker-mode-button-margins.tscn', mode: '2d' },
  // A Button label line wider than its paragraph box.
  { name: 'button-clip-text', file: 'unit-button-clip-text.tscn', mode: '2d' },
  // A CheckBox, CheckButton, OptionButton and MenuButton label wider than its paragraph box.
  { name: 'button-family-clip-text', file: 'unit-button-family-clip-text.tscn', mode: '2d' },
  // A Button, CheckBox, CheckButton, OptionButton and MenuButton label trimmed by text_overrun_behavior.
  { name: 'button-family-text-overrun', file: 'unit-button-family-text-overrun.tscn', mode: '2d' },
  // A Button, CheckBox, CheckButton, OptionButton and MenuButton label wrapped by autowrap_mode.
  { name: 'button-family-autowrap', file: 'unit-button-family-autowrap.tscn', mode: '2d' },
  // A Button and a MenuButton with expand_icon and a label wrapped by autowrap_mode.
  { name: 'button-expand-icon-wrap', file: 'unit-button-expand-icon-wrap.tscn', mode: '2d' },
  // The one variable: the theme type variation of a Button, FlatButton and HeaderSmall beside a plain one.
  // FlatButton and a Label variation draw no normal box, and HeaderSmall takes Label's white text (Godot 4.6.3
  // `--mode 2d`: max 2 of 255 over the grid).
  { name: 'button-default-theme-variations', file: 'unit-button-default-theme-variations.tscn', mode: '2d' },
  // The one variable: the Theme `font_color` of Label on a GraphNode and a GraphFrame title (Godot 4.6.3 `--mode 2d`: max 2 of 255).
  { name: 'graph-title-theme-colour', file: 'unit-graph-title-theme-colour.tscn', mode: '2d' },
  // The one variable: the Theme `normal` StyleBox of Label on a GraphNode and a GraphFrame title (Godot 4.6.3 `--mode 2d`: max 2 of 255).
  { name: 'graph-title-theme-normal-box', file: 'unit-graph-title-theme-normal-box.tscn', mode: '2d' },
  // The one variable: an ancestor Theme that sets the toolbar's Label, FlatButton, LineEdit and SpinBox items.
  { name: 'graph-edit-toolbar-theme', file: 'unit-graph-edit-toolbar-theme.tscn', mode: '2d' },
  { name: 'tab-bar-scroll-to-current', file: 'unit-tab-bar-scroll-to-current.tscn', mode: '2d' },
  { name: 'tab-bar-scroll-options', file: 'unit-tab-bar-scroll-options.tscn', mode: '2d' },
  { name: 'tab-container-hidden-pages', file: 'unit-tab-container-hidden-pages.tscn', mode: '2d' },
  // A y-sorted Control draws its Control children in y order: Red (offset_top 80) over Blue (40) over
  // Green (0), though listed Red, Green, Blue.
  { name: 'control-y-sort', file: 'unit-control-y-sort.tscn', mode: '2d' },
  // A Control child of a y-sorted Node2D sorts on its canvas item origin: Low (80) over the Polygon2D
  // Tile (68), High (10) under it.
  { name: 'control-y-sort-sibling', file: 'unit-control-y-sort-sibling.tscn', mode: '2d' },
  // The same sort where no world y-sort draws the Control's parent: High (50) under Low (100) in a
  // Control-only SubViewport, and in the Control root of a scene tile.
  { name: 'control-y-sort-viewport', file: 'unit-control-y-sort-viewport.tscn', mode: '2d' },
  { name: 'control-y-sort-viewport-mixed', file: 'unit-control-y-sort-viewport-mixed.tscn', mode: '2d' },
  // A Node2D child of the y-sorted Control in a viewport that holds 2D content sorts with the Control
  // children by y: High (50) under Sprite (75) under Low (100), though Sprite is listed last.
  {
    name: 'control-y-sort-viewport-node2d-child',
    file: 'unit-control-y-sort-viewport-node2d-child.tscn',
    mode: '2d',
  },
  { name: 'control-y-sort-scene-tile', file: 'unit-control-y-sort-scene-tile.tscn', mode: '2d' },
];
