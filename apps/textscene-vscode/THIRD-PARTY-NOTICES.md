# Third-party notices

TextScene Inspector is MIT licensed (see `LICENSE`). It additionally contains, and
distributes, material from the third parties below.

Runtime npm dependencies are not enumerated here; each carries its own licence in its
published package.

---

## Godot Engine

<https://github.com/godotengine/godot>

TextScene Inspector reproduces Godot's rendering behaviour, and doing that faithfully means
transcribing engine code rather than approximating it. The files listed below are ports of
Godot Engine source, used under the MIT licence. Each carries the same notice inline.

### Transcribed source

| File | Derived from |
|---|---|
| `packages/textscene-core/src/resources/sky/skyShaders.ts` | `scene/resources/3d/sky_material.cpp` |
| `packages/textscene-core/src/resources/environment/godotToneMapping.ts` | `drivers/gles3/shaders/tonemap_inc.glsl` |
| `packages/textscene-core/src/resources/environment/godotGlow.ts` | `servers/rendering/renderer_rd/shaders/effects/copy.glsl` (`MODE_GLOW` bright pass under `FLAG_GLOW_FIRST_PASS`) and `.../effects/tonemap.glsl` (`gather_glow`, `apply_glow`, and `main()`'s pre/post-tonemap glow ordering) |
| `packages/textscene-core/src/utils/colorSpace.ts` | `core/math/color.h` (`Color::srgb_to_linear`) |
| `packages/textscene-core/src/utils/godotNamedColor.ts` | `core/math/color_names.inc` (the X11 named-colour table, transcribed verbatim) and `core/math/color.cpp` (`Color::find_named_color`'s name normalization, `Color::named`) |
| `packages/textscene-core/src/resources/materials/standardmaterial3d/emission.ts` | `scene/resources/material.cpp` (`BaseMaterial3D::_update_shader` emission block, `set_emission_energy_multiplier`) |
| `packages/textscene-core/src/nodes/3d/csg/smoothNormals.ts` | `modules/csg/csg_shape.cpp` (`CSGShape3D::update_shape` normal accumulation, `flip_faces`) and `core/math/plane.h` (`Plane(p1, p2, p3)`) |
| `packages/textscene-core/src/nodes/3d/csg/csgbox3d/boxGeometry.ts` | `modules/csg/csg_shape.cpp` (`CSGBox3D::_build_brush`) |
| `packages/textscene-core/src/nodes/3d/csg/csgcylinder3d/cylinderGeometry.ts` | `modules/csg/csg_shape.cpp` (`CSGCylinder3D::_build_brush`) |
| `packages/textscene-core/src/nodes/3d/csg/csgsphere3d/sphereGeometry.ts` | `modules/csg/csg_shape.cpp` (`CSGSphere3D::_build_brush`) |
| `packages/textscene-core/src/nodes/3d/csg/csgpolygon3d/polygonGeometry.ts` | `modules/csg/csg_shape.cpp` (`CSGPolygon3D::_build_brush`, the frame-walking loop and its cap/wall emission) |
| `packages/textscene-core/src/nodes/3d/csg/csgpolygon3d/extrusionCounts.ts` | `modules/csg/csg_shape.cpp` (`CSGPolygon3D::_build_brush`'s extrusion/end-cap counts, csg_shape.cpp:2201-2231) |
| `packages/textscene-core/src/nodes/3d/csg/csgpolygon3d/polygonSweepFrames.ts` | `modules/csg/csg_shape.cpp` (`CSGPolygon3D::_build_brush`'s frame basis), `core/math/triangulate.cpp` (`Triangulate::get_area`) and `core/math/transform_3d.cpp` (`Transform3D::looking_at`) |
| `packages/textscene-core/src/nodes/3d/csg/csgpolygon3d/sweepFaceBuffer.ts` | `modules/csg/csg_shape.cpp` (`CSGPolygon3D::_build_brush`'s face buffer and its `face -= extrusion_face_count` rewind) |
| `packages/textscene-core/src/nodes/3d/csg/csgtorus3d/torusGeometry.ts` | `modules/csg/csg_shape.cpp` (`CSGTorus3D::_build_brush`) |
| `packages/textscene-core/src/r3f/lighting2d/CanvasLighting2D.tsx` | `drivers/gles3/shaders/canvas.glsl` (the canvas light pass: `base_color`, `canvas_modulation`, the light loop) and `servers/rendering/renderer_canvas_cull.cpp` (`light->item_mask & ci->light_mask`) |
| `packages/textscene-core/src/r3f/lighting2d/canvasItemLighting.ts` | `drivers/gles3/shaders/canvas.glsl` (`MODE_UNSHADED` / `MODE_LIGHT_ONLY` guards, `light_only_alpha`) and `servers/rendering/renderer_canvas_cull.cpp` (the item cull-mask test) |
| `packages/textscene-core/src/r3f/lighting2d/lightQuad.ts` | `drivers/gles3/shaders/canvas.glsl` (`light_blend_compute`'s three blend modes and the `shadow_color` mix, `light_base_color` energy packing) |
| `packages/textscene-core/src/r3f/lighting2d/lightQuadShaders.ts` | `drivers/gles3/shaders/canvas.glsl` (`light_shadow_compute`'s PCF5/PCF13 tap kernels and the `shadow_pos` quadrant block) |
| `packages/textscene-core/src/r3f/lighting2d/shadowSampling.ts` | `drivers/gles3/rasterizer_canvas_gles3.cpp` (`shadow_pixel_size`, the shadow atlas's linear-filter and repeat-wrap state) |
| `packages/textscene-core/src/r3f/lighting2d/lightCullKey.ts` | `drivers/gles3/rasterizer_canvas_gles3.cpp` (`_record_item_commands`'s per-item light test) and `servers/rendering/renderer_viewport.cpp` (`_draw_viewport`'s per-canvas `layer_min`/`layer_max` filter) |
| `packages/textscene-core/src/r3f/canvasPaintOrder.ts` | `servers/rendering/renderer_canvas_cull.cpp` (`_attach_canvas_item_for_draw`'s per-`z_final` append order and `_cull_canvas_item`'s behind/ahead child split — the whole of Godot's canvas draw order) and `scene/main/canvas_layer.cpp` (`CanvasLayer::set_layer`) |
| `packages/textscene-core/src/r3f/canvasRootScope.tsx` | `scene/main/canvas_item.cpp` (`CanvasItem::get_parent_item`'s null answer for a failed parent cast or a `top_level` item, `_enter_canvas`'s reparent at the canvas, `_handle_visibility_change`'s propagation into a top_level child) and `servers/rendering/renderer_canvas_cull.cpp` (`_render_canvas_item_tree`'s per-canvas-root cull from the canvas transform, a white modulate, z 0 and a null material owner) |
| `packages/textscene-core/src/r3f/lighting2d/canvasItemPlacement.tsx` | `servers/rendering/renderer_canvas_cull.cpp` (`_cull_canvas_item`'s `z_relative` accumulation and CLAMP, `_attach_canvas_item_for_draw`'s `ci->z_final`) |
| `packages/textscene-core/src/r3f/lighting2d/shadowPolarMap.ts` | `drivers/gles3/rasterizer_canvas_gles3.cpp` (`RasterizerCanvasGLES3::light_update_shadow`'s four 90° projections and quadrant viewport packing, `occluder_polygon_set_shape`'s edge extrusion), `drivers/gles3/shaders/canvas_occlusion.glsl` (`depth = dot(direction, vtx.xy)`, `out_depth = depth / z_far`), `drivers/gles3/shaders/canvas.glsl` (the `pos_box` / `pos_rot` quadrant mapping) and `servers/rendering/renderer_viewport.cpp` (`radius_cache`, the `radius/1000` and `radius*1.1` clip planes) |
| `packages/textscene-core/src/r3f/controls/native/controlRectSolver.ts` | `scene/gui/control.cpp` (`Control::_size_changed`'s anchor/offset edge solve, its minimum-size floor with `GROW_DIRECTION_*` and its right-to-left position mirror, `Control::set_rect`/`_compute_offsets`'s inverse of that mirror, `Control::get_combined_minimum_size`, `get_anchorable_rect`) |
| `packages/textscene-core/src/r3f/controls/native/buildSolveTree.ts` | `scene/main/canvas_item.cpp` (`CanvasItem::get_parent_item`'s direct-parent-only cast and `_enter_canvas`'s reparent-at-CanvasLayer fallback when it fails) and `scene/gui/container.cpp` (`Container::as_sortable_control`'s Control cast and `top_level` rejection, which bound the `visible` a container writes onto its children) |
| `packages/textscene-core/src/r3f/controls/native/controlPixelSnap.ts` | `scene/gui/control.cpp` (`Control::_update_canvas_item_transform`'s whole-pixel translation snap and its `is_inside_tree` / 45°-rotation gates), `core/config/project_settings.cpp` (the `gui/common/snap_controls_to_pixels` default and `_GLOBAL_DEF`'s keep-the-loaded-value rule) and `main/main.cpp` (the `bool` read that booleanizes the setting) |
| `packages/textscene-core/src/r3f/controls/native/controlClipping.tsx` | `servers/rendering/renderer_canvas_cull.cpp` (`_cull_canvas_item`'s clip-rect intersection with the enclosing clipper and the separate `final_clip_rect.position` / `.size` rounding that becomes the scissor) and `core/math/vector2.cpp` / `core/math/math_funcs.h` (`Vector2::round` → `Math::round`, half away from zero) |
| `packages/textscene-core/src/nodes/2d/ui/margincontainer/nativeSolver.ts` | `scene/gui/margin_container.cpp` (`MarginContainer::get_minimum_size`, `MarginContainer::_notification`'s `NOTIFICATION_SORT_CHILDREN`) and `scene/gui/container.cpp` (`Container::fit_child_in_rect`) |
| `packages/textscene-core/src/nodes/2d/ui/centercontainer/nativeSolver.ts` | `scene/gui/center_container.cpp` (`CenterContainer::get_minimum_size`, `CenterContainer::_notification`'s `NOTIFICATION_SORT_CHILDREN`) and `scene/gui/container.cpp` (`Container::fit_child_in_rect`) |
| `packages/textscene-core/src/nodes/2d/ui/shared/fitChildInRect.ts` | `scene/gui/container.cpp` (`Container::fit_child_in_rect`) and `scene/gui/control.h` (the `SizeFlags` bitmask, `Container::as_sortable_control`'s visibility test) |
| `packages/textscene-core/src/nodes/2d/ui/shared/boxContainerSolver.ts` | `scene/gui/box_container.cpp` (`BoxContainer::_resort`, `BoxContainer::get_minimum_size`) and `scene/gui/container.cpp` (`Container::fit_child_in_rect`) |
| `packages/textscene-core/src/nodes/2d/ui/shared/splitContainerSolver.ts` | `scene/gui/split_container.cpp` (`SplitContainer::_update_default_dragger_positions`, `_update_dragger_positions`, `_get_valid_range`, `_get_separation`, `_resort`, `get_minimum_size`, `SplitContainerDragger::_notification`'s `NOTIFICATION_DRAW` icon-draw condition) and `scene/gui/container.cpp` (`Container::fit_child_in_rect`) |
| `packages/textscene-core/src/nodes/2d/ui/gridcontainer/nativeSolver.ts` | `scene/gui/grid_container.cpp` (`GridContainer::_notification`'s `NOTIFICATION_SORT_CHILDREN` handler, `GridContainer::get_minimum_size`), `scene/gui/container.cpp` (`Container::fit_child_in_rect`, `Container::as_sortable_control`) and `scene/gui/control.cpp` (`Control::set_rect`/`Control::_size_changed`'s minimum-size floor, which every `fit_child_in_rect` call re-triggers) |
| `packages/textscene-core/src/nodes/2d/ui/graphelement/parser.ts` | `scene/gui/graph_element.cpp` (`GraphElement::set_selectable`'s forced `set_selected(false)`) |
| `packages/textscene-core/src/nodes/2d/ui/graphelement/nativeSolver.ts` | `scene/gui/graph_element.cpp` (`GraphElement::_resort`, `GraphElement::get_minimum_size`) and `scene/gui/container.cpp` (`Container::fit_child_in_rect`, `Container::as_sortable_control`) |
| `packages/textscene-core/src/nodes/2d/ui/graphelement/graphTitlebar.ts` | `scene/gui/graph_node.cpp` (`GraphNode`'s internal `titlebar_hbox`/`title_label` construction, `_resort`'s titlebar geometry) and `scene/gui/graph_frame.cpp` (the same shape) — `Label::_shape`'s OFF-autowrap minimum size and `Label::_get_line_rect`'s line placement |
| `packages/textscene-core/src/nodes/2d/ui/graphnode/parser.ts` | `scene/gui/graph_node.cpp` (`GraphNode::_set`/`_get`/`_get_property_list`'s `slot/<index>/<leaf>` family, `GraphNode::set_slot`'s erase condition) |
| `packages/textscene-core/src/nodes/2d/ui/graphnode/nativeSolver.ts` | `scene/gui/graph_node.cpp` (`GraphNode::_resort`, `GraphNode::get_minimum_size`, `NOTIFICATION_DRAW`'s port/slot-stylebox row geometry) and `scene/gui/container.cpp` (`Container::fit_child_in_rect`) |
| `packages/textscene-core/src/nodes/2d/ui/graphnode/Component.tsx` | `scene/gui/graph_node.cpp` (`GraphNode::_notification`'s `NOTIFICATION_DRAW`) |
| `packages/textscene-core/src/nodes/2d/ui/graphframe/nativeSolver.ts` | `scene/gui/graph_frame.cpp` (`GraphFrame::_resort`, `GraphFrame::get_minimum_size`) and `scene/gui/container.cpp` (`Container::fit_child_in_rect`) |
| `packages/textscene-core/src/nodes/2d/ui/graphframe/Component.tsx` | `scene/gui/graph_frame.cpp` (`GraphFrame::_notification`'s `NOTIFICATION_DRAW`) |
| `packages/textscene-core/src/nodes/2d/ui/graphedit/nativeSolver.ts` | `scene/gui/graph_edit.cpp` (`GraphEdit::_update_scroll_offset`, position half) and `scene/gui/control.cpp` (`Control::_size_changed`'s anchor formula) |
| `packages/textscene-core/src/nodes/2d/ui/graphedit/grid.ts` | `scene/gui/graph_edit.cpp` (`GraphEdit::_draw_grid`) |
| `packages/textscene-core/src/nodes/2d/ui/graphedit/connections.ts` | `scene/gui/graph_edit.cpp` (`GraphEdit::set_connections`) |
| `packages/textscene-core/src/nodes/2d/ui/graphedit/connectionCurve.ts` | `scene/gui/graph_edit.cpp` (`GraphEdit::get_connection_line`) and `scene/resources/curve.cpp` (`Curve2D::_bake_segment2d`, `Curve2D::tessellate`) |
| `packages/textscene-core/src/nodes/2d/ui/graphedit/connectionPorts.ts` | `scene/gui/graph_node.cpp` (`GraphNode::_port_pos_update`, `get_output_port_position`/`get_input_port_position`) |
| `packages/textscene-core/src/nodes/2d/ui/graphedit/connectionEndpoints.ts` | `scene/gui/graph_edit.cpp` (`GraphEdit::_update_connections`) |
| `packages/textscene-core/src/nodes/2d/ui/graphedit/connectionStroke.ts` | `scene/gui/graph_edit.cpp` (`GraphEdit::default_connections_shader`, `GraphEdit::_get_shader_line_width`) |
| `packages/textscene-core/src/nodes/2d/ui/graphedit/ConnectionLine.tsx` | `scene/gui/graph_edit.cpp` (`GraphEdit::_update_connections`) |
| `packages/textscene-core/src/nodes/2d/ui/graphedit/Component.tsx` | `scene/gui/graph_edit.cpp` (`GraphEdit::_notification`'s `NOTIFICATION_DRAW`) |
| `packages/textscene-core/src/nodes/2d/ui/panelcontainer/nativeSolver.ts` | `scene/gui/panel_container.cpp` (`PanelContainer::get_minimum_size`, `PanelContainer::_notification`'s `NOTIFICATION_SORT_CHILDREN` content-rect inset) and `scene/gui/container.cpp` (`Container::fit_child_in_rect`) |
| `packages/textscene-core/src/nodes/2d/ui/subviewportcontainer/nativeSolver.ts` | `scene/gui/subviewport_container.cpp` (`SubViewportContainer::get_minimum_size` and its `stretch` early return) and `scene/main/viewport.h` (`Viewport`'s `Size2i size = Size2i(512, 512)` default) |
| `packages/textscene-core/src/nodes/2d/ui/scrollcontainer/nativeSolver.ts` | `scene/gui/scroll_container.cpp` (`ScrollContainer::get_minimum_size`, `_update_scrollbars`, `_update_scrollbar_position`, `_reposition_children`), `scene/gui/scroll_bar.cpp` (`ScrollBar::get_minimum_size`, `get_grabber_size`, `get_area_size`, `get_grabber_offset`, `NOTIFICATION_DRAW`'s grabber-rect math) and `scene/gui/range.cpp` (`Range::get_as_ratio`, `Range::set_page`'s own CLAMP) |
| `packages/textscene-core/src/nodes/2d/ui/texturerect/nativeSolver.ts` | `scene/gui/texture_rect.cpp` (`TextureRect::get_minimum_size`'s `expand_mode` contribution, `TextureRect::_notification`'s `NOTIFICATION_DRAW` `stretch_mode` draw-rect math) and `scene/main/canvas_item.h` (`TextureFilter`/`TextureRepeat`) |
| `packages/textscene-core/src/nodes/2d/ui/label/nativeSolver.ts` | `scene/gui/label.cpp` (`Label::get_minimum_size` and its `autowrap_mode` branch, backed by `_update_visible`'s per-line height sum and `get_line_height`'s empty-text fallback; `Label::_shape`'s `int width` line-break width and the wrapped `minsize` it leaves behind, plus its trailing `update_minimum_size()`; `Label::_notification`'s `NOTIFICATION_RESIZED` paragraph invalidation; `Label::get_layout_data`'s `vbegin`/`vsep` vertical-alignment math and `_get_line_rect`'s `int(...)` per-line horizontal offsets; `_update_visible`/`get_layout_data`'s own `lines_skipped`/`max_lines_visible` visible-line window; `draw_text`'s per-glyph `visible_characters`/`visible_characters_behavior` skip union and `Label::_shape`'s pre-shape `substr`; the `label_settings`-over-theme precedence in `get_minimum_size`/`_update_visible`/`NOTIFICATION_DRAW`) and `scene/theme/default_theme.cpp` (Label's `StyleBoxEmpty` `normal_style`, `line_spacing` 3 and opaque-white `font_color`) |
| `packages/textscene-core/src/nodes/2d/ui/richtextlabel/nativeSolver.ts` | `scene/gui/rich_text_label.cpp` (`RichTextLabel::get_minimum_size`, backed by `get_content_height`/`get_content_width`) and `scene/theme/default_theme.cpp` (RichTextLabel's `default_color`/`line_separation`/`paragraph_separation` theme defaults; the bold/italic `FontVariation`'s `set_variation_embolden(1.2)`/`set_variation_transform`'s `0.2` shear) |
| `packages/textscene-core/src/nodes/2d/ui/button/nativeSolver.ts` | `scene/gui/button.cpp` (`Button::get_minimum_size_for_text_and_icon`) and `scene/theme/default_theme.cpp` (Button's `font_color`/`font_disabled_color`/`icon_normal_color`/`icon_disabled_color` theme defaults) |
| `packages/textscene-core/src/nodes/2d/ui/menubar/nativeSolver.ts` | `scene/gui/menu_bar.cpp` (`MenuBar::get_minimum_size`, `MenuBar::shape`, `MenuBar::_get_menu_item_rect`, `MenuBar::_draw_menu_item`'s normal-state StyleBox/font-colour selection and `MenuBar::_refresh_menu_names`'s title-vs-name fallback) and `scene/theme/default_theme.cpp` (MenuBar's `button_normal`/`h_separation`/`font_color` theme defaults, shared with Button's own) |
| `packages/textscene-core/src/nodes/2d/ui/menubutton/nativeSolver.ts` | `scene/gui/button.cpp` (`Button::get_minimum_size_for_text_and_icon`, reused unchanged since `menu_button.cpp` overrides neither) and `scene/theme/default_theme.cpp` (MenuButton's own `font_disabled_color` theme default) |
| `packages/textscene-core/src/nodes/2d/ui/foldablecontainer/nativeSolver.ts` | `scene/gui/foldable_container.cpp` (`FoldableContainer::get_minimum_size`, `_update_title_min_size`, `_get_title_style`/`_get_title_icon`/`_get_actual_alignment`, `_notification`'s `NOTIFICATION_SORT_CHILDREN` content-fitting and `set_visible(!folded)` branches) and `scene/theme/default_theme.cpp` (FoldableContainer's `title_panel`/`title_collapsed_panel`/`panel` styleboxes, its own `font_color`/`collapsed_font_color` defaults, `h_separation` and arrow icon registrations) |
| `packages/textscene-core/src/r3f/controls/native/buttonBase.ts` | `scene/gui/button.cpp` (`Button::_notification`'s `NOTIFICATION_DRAW` icon/text content-layout math and `Button::_fit_icon_size`) |
| `packages/textscene-core/src/nodes/2d/ui/checkbox/nativeSolver.ts` | `scene/gui/check_box.cpp` (`CheckBox::get_minimum_size`, `get_icon_size`, `_notification`'s `NOTIFICATION_DRAW` icon placement, `is_radio`) and `scene/gui/base_button.cpp` (`BaseButton::get_draw_mode`) |
| `packages/textscene-core/src/nodes/2d/ui/optionbutton/nativeSolver.ts` | `scene/gui/option_button.cpp` (`OptionButton::get_minimum_size`, `_refresh_size_cache`, `_notification`'s `NOTIFICATION_DRAW` arrow placement) |
| `packages/textscene-core/src/nodes/2d/ui/tabbar/nativeSolver.ts` | `scene/gui/tab_bar.cpp` (`TabBar::get_minimum_size`, `TabBar::get_tab_width`, `TabBar::_update_cache`, `TabBar::_draw_tab`) and `scene/theme/default_theme.cpp` (TabBar's `tab_selected`/`tab_unselected`/`tab_disabled`/`tab_hovered` styleboxes and its `font_selected_color`/`font_unselected_color`/`font_disabled_color`/icon-colour theme defaults) |
| `packages/textscene-core/src/nodes/2d/ui/tabcontainer/nativeSolver.ts` | `scene/gui/tab_container.cpp` (`TabContainer::get_minimum_size`, `TabContainer::_repaint`, `TabContainer::_update_margins`, `TabContainer::_get_tab_height`/`_get_tab_rect`) |
| `packages/textscene-core/src/nodes/2d/ui/lineedit/nativeSolver.ts` | `scene/gui/line_edit.cpp` (`LineEdit::get_minimum_size`, `_notification`'s `NOTIFICATION_DRAW` content-rect/alignment/colour selection and its `right_icon`/clear-button inset and caret-fallback math, `LineEdit::_get_right_icon_size`) and `scene/theme/default_theme.cpp` (LineEdit's `normal`/`read_only` styleboxes, `font_color`/`font_placeholder_color`/`font_uneditable_color`/`caret_color`/`clear_button_color` theme defaults and the `caret_width` constant) |
| `packages/textscene-core/src/nodes/2d/ui/textedit/nativeSolver.ts` | `scene/gui/text_edit.cpp` (`TextEdit::get_minimum_size`, `_update_scrollbars`'s `content_size_cache`, `_update_wrap_at_column`, `get_line_height`, `TextEdit::Text::get_line_height`, `adjust_viewport_to_caret`/`_adjust_viewport_to_caret_horizontally`'s own always-(0,0) trace, `_notification`'s `NOTIFICATION_DRAW` `left_margin`/`xmargin_beg`/`xmargin_end` row band, `TextEdit::Text::invalidate_cache`/`invalidate_all_lines`'s tab-align vector) and `scene/theme/default_theme.cpp` (TextEdit's reuse of LineEdit's `normal`/`read_only` styleboxes, `font_color`/`font_readonly_color`/`current_line_color`, the scaled `line_spacing` constant and the bare `wrap_offset`/content-size-pad literals) |
| `packages/textscene-core/src/nodes/2d/ui/codeedit/nativeSolver.ts` | `scene/gui/code_edit.cpp` (`CodeEdit::CodeEdit()`'s fixed gutter construction order and each gutter's own width setter, `_update_draw_main_gutter`, `_text_changed`'s line-number digit count, `_line_number_draw_callback`, `_update_line_number_gutter_width`, `set_line_numbers_zero_padded`) and `scene/theme/default_theme.cpp` (CodeEdit's reuse of TextEdit's/LineEdit's styleboxes and its own `line_number_color`) |
| `packages/textscene-core/src/nodes/2d/ui/codeedit/delimiterRegions.ts` | `scene/gui/code_edit.cpp` (`_set_delimiters`'s per-type entry loop, `_add_delimiter`'s repeated-key refusal and longest-first insertion, `_update_delimiter_cache`, `_is_in_delimiter`, `get_delimiter_start_position`, `get_delimiter_end_position`, `_update_code_region_tags`) |
| `packages/textscene-core/src/nodes/2d/ui/codeedit/lineFolding.ts` | `scene/gui/code_edit.cpp` (`can_fold_line`, `is_line_code_region_start`, `is_line_code_region_end`) and `scene/gui/text_edit.cpp` (`get_indent_level`) |
| `packages/textscene-core/src/resources/styles/codehighlighter/decode.ts` | `scene/resources/syntax_highlighter.cpp` (`CodeHighlighter`'s `ADD_PROPERTY` declarations and `add_color_region`'s key-validation/insertion-order rules) |
| `packages/textscene-core/src/resources/styles/codehighlighter/highlight.ts` | `scene/resources/syntax_highlighter.cpp` (`CodeHighlighter::_get_line_syntax_highlighting_impl`) and `core/string/char_utils.h` (`is_symbol`/`is_digit`/`is_hex_digit`/`is_ascii_alphabet_char`) |
| `packages/textscene-core/src/nodes/2d/ui/tree/nativeSolver.ts` | `scene/gui/tree.cpp` (`Tree::_get_content_rect`, `Tree::_get_title_button_height`, `Tree::get_column_width`, `Tree::get_column_minimum_width`, restricted to the always-empty-of-items case a `.tscn` Tree is) and `scene/theme/default_theme.cpp` (Tree's `panel` and `title_button_normal` styleboxes) |
| `packages/textscene-core/src/nodes/2d/ui/spinbox/nativeSolver.ts` | `scene/gui/spin_box.cpp` (`SpinBox::get_minimum_size`, `_compute_sizes`, `_get_widest_button_icon_width`, `_update_text`, `_update_buttons_state_for_current_value`), `scene/gui/range.h` (`Range`'s own `step` default), `core/math/math_funcs.cpp` (`Math::step_decimals`, `Math::range_step_decimals`), `core/string/ustring.cpp` (`String::num`'s trailing-zero trim) and `scene/theme/default_theme.cpp` (SpinBox's `buttons_width`/`field_and_buttons_separation` constants and `up`/`down` icon-modulate defaults) |
| `packages/textscene-core/src/nodes/2d/ui/itemlist/nativeSolver.ts` | `scene/gui/item_list.cpp` (`ItemList::force_update_list_size`, `ItemList::get_minimum_size`, the per-item minsize inline in `force_update_list_size`, `_adjust_to_max_size`, `NOTIFICATION_DRAW`'s per-row icon/text placement and its `:1446-1459` row/column guide-line draw) and `scene/theme/default_theme.cpp` (ItemList's `panel`/`h_separation`/`v_separation`/`icon_margin`/`line_separation`/`font_color`/`guide_color` theme defaults) |
| `packages/textscene-core/src/nodes/2d/ui/shared/sliderSolver.ts` | `scene/gui/slider.cpp` (`Slider::get_minimum_size`, `_notification`'s `NOTIFICATION_DRAW` track/`grabber_area`/grabber/tick rect math, including its per-axis `int` truncation vs `Math::round` asymmetry) and `scene/theme/default_theme.cpp` (HSlider/VSlider's `slider`/`grabber_area` styleboxes and grabber/tick icon registration) |
| `packages/textscene-core/src/r3f/controls/native/styleBoxFlatGeometry.ts` | `scene/resources/style_box_flat.cpp` (`StyleBoxFlat::draw`, `draw_rounded_rectangle`, `adapt_values`, `set_inner_corner_radius`, `set_corner_scale`, including the anti-aliasing rings, `skew`, and the drop-shadow stage) |
| `packages/textscene-core/src/r3f/controls/native/text/TextRun.tsx` | `scene/gui/label.cpp` (`Label::_notification`'s `ofs.y += asc` baseline anchoring) and the TextServer paragraph convention `Button::_notification`'s `text_buf->draw` shares; `modules/text_server_adv/text_server_adv.cpp` (`FT_Outline_Transform`'s synthesized-italic shear pivot) |
| `packages/textscene-core/src/nodes/2d/ui/graphedit/toolbar.ts` | `scene/gui/graph_edit.cpp` (the `menu_panel`/`menu_hbox` constructor assembly, the `set_show_*` setters and `GraphEdit::_update_zoom_label`) |
| `packages/textscene-core/src/nodes/2d/ui/graphedit/ToolbarChrome.tsx` | `scene/gui/graph_edit.cpp` (the toolbar's own `Button`/`Label` draw) and `scene/theme/default_theme.cpp` (the `FlatButton` variation) |
| `packages/textscene-core/src/nodes/2d/ui/graphedit/minimap.ts` | `scene/gui/graph_edit.cpp` (`GraphEditMinimap::update_minimap`, `get_camera_rect`, `_get_render_size`, `_get_graph_size`, `_convert_from_graph_position`) |
| `packages/textscene-core/src/nodes/2d/ui/graphedit/MinimapChrome.tsx` | `scene/gui/graph_edit.cpp` (`GraphEditMinimap::_minimap_draw`) |
| `packages/textscene-core/src/nodes/2d/ui/graphedit/scrollBars.ts` | `scene/gui/graph_edit.cpp` (`GraphEdit::_update_scrollbars`) and `scene/gui/scroll_bar.cpp` (grabber geometry) |
| `packages/textscene-core/src/nodes/2d/ui/graphedit/loadOrder.ts` | `scene/gui/graph_edit.cpp` (`GraphEdit::set_scroll_offset`, `set_zoom_custom`, `set_zoom_min`/`set_zoom_max` and the constructor's zoom bounds), `scene/gui/control.cpp` (`Control::_size_changed` out of tree) and `scene/resources/packed_scene.cpp` (`SceneState::instantiate`'s property order) |
| `packages/textscene-core/src/nodes/2d/ui/graphedit/minimapConnections.ts` | `scene/gui/graph_edit.cpp` (`GraphEdit::_draw_minimap_connection_line`) |
| `packages/textscene-core/src/nodes/2d/ui/graphedit/polylineStroke.ts` | `servers/rendering/renderer_canvas_cull.cpp` (`RendererCanvasCull::canvas_item_add_polyline`, `compute_polyline_segment_dir`, `compute_polyline_edge_offset_clamped`) |
| `packages/textscene-core/src/r3f/controls/native/text/hexCodeBox.ts` | `servers/text/text_server.cpp` (`TextServer::get_hex_code_box_size`, `TextServer::draw_hex_code_box`, `TextServer::_draw_hex_code_box_number`) |
| `packages/textscene-core/src/r3f/controls/native/text/textLayout.ts` | `scene/gui/label.cpp` (`Label::_shape`'s autowrap flag mapping) and `servers/text/text_server.cpp` (`TextServer::shaped_text_get_line_breaks`'s width accumulation, safe-break bookkeeping and edge-space trimming) |
| `packages/textscene-core/src/r3f/controls/native/text/textOverrun.ts` | `modules/text_server_adv/text_server_adv.cpp` (`TextServerAdvanced::_shaped_text_overrun_trim_to_width`) and `servers/text/text_server.cpp` (`TextServer::get_overrun_flags_from_behavior`, `shaped_text_draw`'s trim/ellipsis consumption) |
| `packages/textscene-core/src/r3f/controls/native/text/textJustify.ts` | `modules/text_server_adv/text_server_adv.cpp` (`TextServerAdvanced::_shaped_text_fit_to_width`) |
| `packages/textscene-core/src/r3f/controls/native/text/textTabStops.ts` | `modules/text_server_adv/text_server_adv.cpp` (`TextServerAdvanced::_shaped_text_tab_align`) |
| `packages/textscene-core/src/nodes/3d/label3d/glyphLayout.ts` | `scene/3d/label_3d.cpp` (`Label3D::_shape`'s per-line vertical origin for `VERTICAL_ALIGNMENT_*` and horizontal line offset for `HORIZONTAL_ALIGNMENT_*`, including `FILL` falling through to `CENTER`) |
| `packages/textscene-core/src/nodes/2d/ui/aspectratiocontainer/nativeSolver.ts` | `scene/gui/aspect_ratio_container.cpp` (`AspectRatioContainer::get_minimum_size` and `_notification`'s `NOTIFICATION_SORT_CHILDREN` ratio/stretch-mode/alignment math, including its proportional-TextureRect skip) and `scene/gui/container.cpp` (`Container::fit_child_in_rect`) |
| `packages/textscene-core/src/nodes/2d/ui/checkbutton/nativeSolver.ts` | `scene/gui/check_button.cpp` (`CheckButton::get_minimum_size`, `get_icon_size`, `_notification`'s `NOTIFICATION_DRAW` toggle placement and layout-direction icon/side selection) and `scene/theme/default_theme.cpp` (CheckButton's `checked`/`unchecked` icons, `h_separation`, `check_v_offset` and `cb_empty` margins) |
| `packages/textscene-core/src/nodes/2d/ui/flowcontainer/nativeSolver.ts` | `scene/gui/flow_container.cpp` (`FlowContainer::_resort`'s line-wrapping pass, per-line cross-axis fill, EXPAND stretch, `alignment`/`last_wrap_alignment`/`reverse_fill`, and `get_minimum_size`) and `scene/gui/container.cpp` (`Container::fit_child_in_rect`) |
| `packages/textscene-core/src/nodes/2d/ui/linkbutton/nativeSolver.ts` | `scene/gui/link_button.cpp` (`LinkButton::get_minimum_size` and `_notification`'s `NOTIFICATION_DRAW` underline position/thickness and per-state font colour), `scene/theme/default_theme.cpp` (LinkButton's `font_color`/`underline_spacing`) and `scene/theme/theme_db.cpp` (the fallback chain that leaves `font_disabled_color` unregistered) |
| `packages/textscene-core/src/nodes/2d/ui/ninepatchrect/nativeSolver.ts` | `scene/gui/nine_patch_rect.cpp` (`NinePatchRect::get_minimum_size`), `scene/main/canvas_item.h` and `scene/main/viewport.h` (the texture filter/repeat defaults a nine-patch samples under) |
| `packages/textscene-core/src/nodes/2d/ui/progressbar/nativeSolver.ts` | `scene/gui/progress_bar.cpp` (`ProgressBar::get_minimum_size`, `_notification`'s `NOTIFICATION_DRAW` background/fill windowing per `fill_mode` and the centred percentage label) and `scene/theme/default_theme.cpp` (ProgressBar's `background`/`fill` styleboxes and `font_color`/`font_outline_color`) |
| `packages/textscene-core/src/nodes/2d/ui/separator/styleBoxLine.ts` | `scene/theme/default_theme.cpp` (the default `separator` StyleBoxLine's colour, thickness and content margin, and `Separator`'s own `separation` constant) |
| `packages/textscene-core/src/nodes/2d/ui/separator/separatorPlacement.ts` | `scene/gui/separator.cpp` (`Separator::_notification`'s `NOTIFICATION_DRAW` placement rect) and `scene/resources/style_box.cpp` (`StyleBox::get_minimum_size`) |
| `packages/textscene-core/src/r3f/controls/native/styleBoxLine.ts` | `scene/resources/style_box_line.h`/`.cpp` (`StyleBoxLine`'s fields and `get_style_margin`) and `scene/resources/style_box.cpp` (`StyleBox::get_margin`) |
| `packages/textscene-core/src/r3f/controls/native/styleBoxLineGeometry.ts` | `scene/resources/style_box_line.cpp` (`StyleBoxLine::draw`) |
| `packages/textscene-core/src/r3f/controls/native/styleBoxTexture.ts` | `scene/resources/style_box_texture.h`/`.cpp` (`StyleBoxTexture`'s fields, `get_style_margin`, and the rect/region/margin computation in `draw`) and `scene/resources/style_box.cpp` (`StyleBox::get_margin`) |
| `packages/textscene-core/src/r3f/controls/native/StyleBoxQuad.tsx` | `scene/resources/style_box_line.cpp` (`StyleBoxLine::draw`) and `scene/resources/style_box_texture.cpp` (`StyleBoxTexture::draw`'s `expand_margin` grow and `modulate_color` composition) |
| `packages/textscene-core/src/nodes/2d/ui/shared/scrollBarSolver.ts` | `scene/gui/scroll_bar.cpp` (`ScrollBar::get_minimum_size`, `get_area_size`, `get_grabber_size`, `get_grabber_offset` and `_notification`'s `NOTIFICATION_DRAW` track/grabber rects) |
| `packages/textscene-core/src/nodes/2d/ui/texturebutton/nativeSolver.ts` | `scene/gui/texture_button.cpp` (`TextureButton::get_minimum_size` and `_notification`'s `NOTIFICATION_DRAW` per-state texture selection and `stretch_mode` rect math, including its float arithmetic where TextureRect truncates) |
| `packages/textscene-core/src/nodes/2d/ui/textureprogressbar/nativeSolver.ts` | `scene/gui/texture_progress_bar.cpp` (`TextureProgressBar::get_minimum_size` and the `fill_mode`/`radial_*` setters' clamping) |
| `packages/textscene-core/src/nodes/2d/ui/textureprogressbar/linearFill.ts` | `scene/gui/texture_progress_bar.cpp` (`_notification`'s `NOTIFICATION_DRAW` linear `FILL_*` crop rects) |
| `packages/textscene-core/src/nodes/2d/ui/textureprogressbar/ninePatchProgress.ts` | `scene/gui/texture_progress_bar.cpp` (`draw_nine_patch_stretched`) and `scene/resources/texture.cpp` (the region a stretched progress patch samples) |
| `packages/textscene-core/src/nodes/2d/ui/textureprogressbar/radialFill.ts` | `scene/gui/texture_progress_bar.cpp` (`get_relative_center`, `draw_circular_progress` and its `radial_initial_angle`/`radial_fill_degrees` fan) and `core/math/math_funcs.h` (`Math::fposmod`) |
| `packages/textscene-core/src/resources/curves/curve/sample.ts` | `scene/resources/curve.cpp` (`Curve::sample`, `Curve::sample_local_nocheck`, `Curve::get_index`) and `core/math/math_funcs.h` (`Math::bezier_interpolate`) |
| `packages/textscene-core/src/nodes/2d/cpuparticles2d/godotRng.ts` | `core/math/random_pcg.h` (`RandomPCG::seed`, `RandomPCG::randf`), `thirdparty/misc/pcg.cpp` (`pcg32_random_r`, `pcg32_srandom_r` — see the PCG note below) and `scene/2d/cpu_particles_2d.cpp` (`idhash`, `rand_from_seed`) |
| `packages/textscene-core/src/nodes/2d/cpuparticles2d/simulate.ts` | `scene/2d/cpu_particles_2d.cpp` (the `_update_internal` preprocess loop and its fixed-step evaluation window) |
| `packages/textscene-core/src/nodes/2d/cpuparticles2d/particlesProcess.ts` | `scene/2d/cpu_particles_2d.cpp` (`CPUParticles2D::_particles_process`'s per-frame loop: cycle bookkeeping, restart phase, the emission transform) |
| `packages/textscene-core/src/nodes/2d/cpuparticles2d/particleRestart.ts` | `scene/2d/cpu_particles_2d.cpp` (`_particles_process`'s restart branch and its emission-shape offsets) |
| `packages/textscene-core/src/nodes/2d/cpuparticles2d/particleAdvance.ts` | `scene/2d/cpu_particles_2d.cpp` (`_particles_process`'s alive branch: the accelerations, orbit, damping and angular integration) |
| `packages/textscene-core/src/nodes/2d/cpuparticles2d/particleAppearance.ts` | `scene/2d/cpu_particles_2d.cpp` (`_particles_process`'s appearance pass) and `core/math/color.cpp` (the YIQ-style hue-rotation basis) |
| `packages/textscene-core/src/nodes/2d/cpuparticles2d/particleBuffer.ts` | `scene/2d/cpu_particles_2d.cpp` (`_update_particle_data_buffer`, `SortLifetime`) |
| `packages/textscene-core/src/nodes/2d/cpuparticles2d/affine2d.ts` | `core/math/transform_2d.cpp` (`Transform2D::basis_xform`, `Transform2D::operator*`, `Transform2D::affine_inverse`) |
| `scripts/godot-ref/bootstrap.mjs` | `editor/plugins/node_3d_editor_plugin.cpp` (`Node3DEditor::_node_added` yield rule, `_load_default_preview_settings`, `_preview_settings_changed`) |
| `scripts/godot-ref/refConstants.mjs` | `editor/plugins/node_3d_editor_plugin.cpp` (`Node3DEditorViewport::Cursor()`) |
| `packages/textscene-core/src/nodes/2d/ui/videostreamplayer/nativeSolver.ts` | `scene/gui/video_stream_player.cpp` (`VideoStreamPlayer::get_minimum_size`) |
| `packages/textscene-core/src/nodes/2d/ui/colorpickerbutton/Component.tsx` | `scene/gui/color_picker.cpp` (`ColorPickerButton::_notification`'s `NOTIFICATION_DRAW`: the swatch rect from the "normal" StyleBox's offset/minimum size, the unconditional checkerboard, and the overbright check) |
| `packages/textscene-core/src/nodes/2d/ui/shared/AlphaCheckerboardQuad.tsx` | `scene/gui/color_picker.cpp` (`draw_texture_rect(theme_cache.background_icon, r, true)`'s tile semantics, ported the same way `nodes/2d/ui/texturerect/Component.tsx`'s `STRETCH_TILE` branch already does) |
| `packages/textscene-core/src/nodes/2d/ui/shared/colorOverbright.ts` | `scene/gui/color_picker.cpp` (`is_color_overbright`) |
| `packages/textscene-core/src/nodes/2d/ui/colorpicker/nativeSolver.ts` | `scene/gui/color_picker.cpp` (`ColorPicker::_set_pick_color`'s HSV derivation: `_copy_color_to_normalized_and_intensity`, `_copy_normalized_to_hsv_okhsl`; the constructor's `real_vbox` row order and every row-visibility setter; `create_slider`/`_update_controls`) and `core/math/color.cpp`/`.h` (`Color::get_h`/`get_s`/`get_v`, `Color::from_hsv`/`set_hsv`, `Color::inverted`, `Color::srgb_to_linear`/`linear_to_srgb`), `scene/gui/color_picker_shape.cpp` (`ColorPickerShape::draw_sv_square`'s cursor placement, `ColorPickerShapeRectangle::_hue_slider_draw`'s indicator line, `ColorPickerShapeRectangle::update_theme`), `scene/gui/spin_box.cpp` (`SpinBox::get_minimum_size`) and `scene/theme/default_theme.cpp` (ColorPicker's `sv_width`/`sv_height`/`h_width`/`margin`/`label_width` constants, the `color_hue` `GradientTexture2D`'s 7-stop hue gradient, and `make_flat_stylebox`'s default Button/LineEdit margins) |
| `packages/textscene-core/src/nodes/2d/ui/colorpicker/svGradient.ts` | `scene/gui/color_picker_shape.cpp` (`ColorPickerShape::draw_sv_square`'s two `draw_polygon` layers), `scene/gui/color_mode.cpp` (every `ColorMode::slider_draw` override's 2/3/7-stop polygons) and `scene/theme/default_theme.cpp` (the `color_hue` `GradientTexture2D`'s 7-stop hue gradient) |
| `packages/textscene-core/src/nodes/2d/ui/colorpicker/colorModes.ts` | `scene/gui/color_mode.cpp`/`.h` (every `ColorMode` subclass: `get_slider_value`/`get_slider_max`/`get_alpha_slider_max`/`get_alpha_slider_value`/`slider_draw`), `scene/gui/color_picker.cpp` (`_copy_color_to_normalized_and_intensity`, `_update_text_value`, `_alpha_slider_draw`, `is_color_valid_hex`/`_append_hex`) and `core/math/color.cpp` (`Color::to_html`, `Color::srgb_to_linear`) |
| `packages/textscene-core/src/nodes/2d/ui/colorpicker/okhsl.ts` | `core/math/color.cpp` (`Color::set_ok_hsl`/`get_ok_hsl_h`/`get_ok_hsl_s`/`get_ok_hsl_l`) and `thirdparty/misc/ok_color.h` (MIT, Copyright (c) 2021 Björn Ottosson — `srgb_to_okhsl`/`okhsl_to_srgb` and their shared helpers) |
| `packages/textscene-core/src/nodes/2d/ui/colorpicker/Component.tsx` | `scene/gui/color_picker.cpp` (`ColorPicker::_sample_draw`, the constructor's `sample_hbc`/`mode_hbc`/`hex_hbc`/`swatches_vbc` layout) and `scene/gui/color_picker_shape.cpp` (`ColorPickerShape::draw_cursor`) |

### Reproduced values

Beyond the transcriptions above, property defaults, enum values, default colours and
editor constants are read from Godot source throughout the codebase and cited per file at
the point of use, for example `nodes/physics/shared/debugColor.ts`,
`resources/sky/decode.ts`, `resources/textures/gradienttexture2d/parser.ts`,
`resources/tileset/tilePlacement.ts` and `r3f/godotEditorCamera.ts`.

### Vendored theme icons

The native (WebGL) Control renderer's CheckBox, OptionButton, SplitContainer-family,
CheckButton, FoldableContainer, TextEdit/CodeEdit, TabBar and ColorPicker/
ColorPickerButton painters need the same indicator glyphs Godot's editor bakes into its
built-in dark theme. Rather than redraw approximations, `packages/textscene-core/src/r3f/controls/native/themeIcons.ts`
embeds unmodified copies of the actual SVG files, base64-encoded as `data:` URLs, from
Godot 4.6.3's `scene/theme/icons/`:

| File | Godot theme key (`scene/theme/default_theme.cpp`) |
|---|---|
| `scene/theme/icons/checked.svg` | `CheckBox` / `"checked"` |
| `scene/theme/icons/checked_disabled.svg` | `CheckBox` / `"checked_disabled"` |
| `scene/theme/icons/unchecked.svg` | `CheckBox` / `"unchecked"` |
| `scene/theme/icons/unchecked_disabled.svg` | `CheckBox` / `"unchecked_disabled"` |
| `scene/theme/icons/radio_checked.svg` | `CheckBox` / `"radio_checked"` |
| `scene/theme/icons/radio_checked_disabled.svg` | `CheckBox` / `"radio_checked_disabled"` |
| `scene/theme/icons/radio_unchecked.svg` | `CheckBox` / `"radio_unchecked"` |
| `scene/theme/icons/radio_unchecked_disabled.svg` | `CheckBox` / `"radio_unchecked_disabled"` |
| `scene/theme/icons/option_button_arrow.svg` | `OptionButton` / `"arrow"` |
| `scene/theme/icons/hsplitter.svg` | `HSplitContainer` / `"grabber"`, `SplitContainer` / `"h_grabber"` |
| `scene/theme/icons/vsplitter.svg` | `VSplitContainer` / `"grabber"`, `SplitContainer` / `"v_grabber"` |
| `scene/theme/icons/toggle_on.svg` | `CheckButton` / `"checked"` |
| `scene/theme/icons/toggle_on_disabled.svg` | `CheckButton` / `"checked_disabled"` |
| `scene/theme/icons/toggle_off.svg` | `CheckButton` / `"unchecked"` |
| `scene/theme/icons/toggle_off_disabled.svg` | `CheckButton` / `"unchecked_disabled"` |
| `scene/theme/icons/toggle_on_mirrored.svg` | `CheckButton` / `"checked_mirrored"` |
| `scene/theme/icons/toggle_on_disabled_mirrored.svg` | `CheckButton` / `"checked_disabled_mirrored"` |
| `scene/theme/icons/toggle_off_mirrored.svg` | `CheckButton` / `"unchecked_mirrored"` |
| `scene/theme/icons/toggle_off_disabled_mirrored.svg` | `CheckButton` / `"unchecked_disabled_mirrored"` |
| `scene/theme/icons/arrow_down.svg` | `FoldableContainer` / `"expanded_arrow"`, `CodeEdit` / `"can_fold"` |
| `scene/theme/icons/arrow_up.svg` | `FoldableContainer` / `"expanded_arrow_mirrored"` |
| `scene/theme/icons/arrow_right.svg` | `FoldableContainer` / `"folded_arrow"` |
| `scene/theme/icons/arrow_left.svg` | `FoldableContainer` / `"folded_arrow_mirrored"` |
| `scene/theme/icons/region_unfolded.svg` | `CodeEdit` / `"can_fold_code_region"` |
| `scene/theme/icons/text_edit_tab.svg` | `TextEdit` / `"tab"`, `CodeEdit` / `"tab"` |
| `scene/theme/icons/text_edit_space.svg` | `TextEdit` / `"space"`, `CodeEdit` / `"space"` |
| `scene/theme/icons/scroll_hint_vertical.svg` | `ScrollContainer` / `"scroll_hint_vertical"` |
| `scene/theme/icons/scroll_hint_horizontal.svg` | `ScrollContainer` / `"scroll_hint_horizontal"` |
| `scene/theme/icons/close.svg` | `TabBar` / `"close"` |
| `scene/theme/icons/scroll_button_right.svg` | `TabBar` / `"increment"` |
| `scene/theme/icons/scroll_button_left.svg` | `TabBar` / `"decrement"` |
| `scene/theme/icons/mini_checkerboard.svg` | `ColorPickerButton` / `"bg"`, `ColorPicker` / `"sample_bg"` |
| `scene/theme/icons/color_picker_overbright.svg` | `ColorPickerButton`/`ColorPicker` / `"overbright_indicator"` |
| `scene/theme/icons/color_picker_cursor.svg` | `ColorPicker` / `"picker_cursor"` |
| `scene/theme/icons/color_picker_cursor_bg.svg` | `ColorPicker` / `"picker_cursor_bg"` |

`packages/textscene-core/src/nodes/2d/ui/spinbox/icons.ts` embeds SpinBox's own pair the
same way, kept in its own slice rather than `themeIcons.ts` since that module is
orchestrator-owned:

| File | Godot theme key (`scene/theme/default_theme.cpp`) |
|---|---|
| `scene/theme/icons/value_up.svg` | `SpinBox` / `"up"` (also `"up_disabled"` — the same asset) |
| `scene/theme/icons/value_down.svg` | `SpinBox` / `"down"` (also `"down_disabled"` — the same asset) |

`packages/textscene-core/src/nodes/2d/ui/graphelement/graphIcons.ts` embeds GraphNode's/GraphFrame's `resizer`/`port` icon pair the same way, kept in its own slice for the same reason:

| File | Godot theme key (`scene/theme/default_theme.cpp`) |
|---|---|
| `scene/theme/icons/resizer_se.svg` | `GraphElement`/`GraphNode`/`GraphFrame` / `"resizer"` |
| `scene/theme/icons/graph_port.svg` | `GraphNode` / `"port"` |

`packages/textscene-core/src/nodes/2d/ui/lineedit/icons.ts` embeds LineEdit's own clear-button icon the same way, kept in its own slice for the same reason:

| File | Godot theme key (`scene/theme/default_theme.cpp`) |
|---|---|
| `scene/theme/icons/line_edit_clear.svg` | `LineEdit` / `"clear"` |

Each theme key is simply its SVG filename without extension (`default_theme_icons_builders.py`).
Licensed under the same Godot Engine MIT licence below.

### Licence

```
Copyright (c) 2014-present Godot Engine contributors (see AUTHORS.md).
Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Open Sans font

<https://github.com/googlefonts/opensans>

Godot's default theme renders UI text with `OpenSans_SemiBold.woff2`
(`thirdparty/fonts/`). The native (WebGL) Control text painter needs a real font to
match Godot's line-breaking and line-pitch pixel-for-pixel (see
`packages/textscene-core/src/r3f/controls/native/text/openSansMetrics.ts`'s citations of
`modules/text_server_adv/text_server_adv.cpp` and `scene/theme/default_theme.cpp`), so it
vendors the identical font Godot ships rather than substituting a system or web font.

`packages/textscene-core/assets/fonts/OpenSans_SemiBold.woff2` is an unmodified copy of
Godot 4.6.3's vendored file. `scripts/fonts/bake-metrics.mjs` reads it at build time
(decompressing to a TTF in memory, since neither the metrics tool nor the atlas tool
decompresses real Brotli woff2 itself) and bakes the two committed artifacts
`openSansMetrics.ts` (font-wide scalar metrics + kerning table) and `openSansAtlas.ts`
(the pre-baked MSDF glyph atlas — see ADR-0003 and `packages/textscene-core/src/r3f/controls/native/text/openSansAtlas.ts`'s own citation of why a
pre-baked atlas, not a runtime font parse, is what the VS Code webview CSP allows).

Per Godot's own `COPYRIGHT.txt` (`Files: thirdparty/fonts/OpenSans*.woff2`) and
`thirdparty/README.md`:

- Upstream: <https://github.com/googlefonts/opensans>
- Version: git `bd7e37632246368c60fdcbd374dbf9bad11969b6` (2023)
- Copyright: 2020, The Open Sans Project Authors
- Licence: SIL Open Font License, Version 1.1 (OFL-1.1)

```
Copyright 2020 The Open Sans Project Authors (https://github.com/googlefonts/opensans)

-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font
creation efforts of academic and linguistic communities, and to
provide a free and open framework in which fonts may be shared and
improved in partnership with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply to
any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software
components as distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to,
deleting, or substituting -- in part or in whole -- any of the
components of the Original Version, by changing formats or by porting
the Font Software to a new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed,
modify, redistribute, and sell modified and unmodified copies of the
Font Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components, in
Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the
corresponding Copyright Holder. This restriction only applies to the
primary font name as presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created using
the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

---

## PCG random number generator

<https://www.pcg-random.org>

`packages/textscene-core/src/nodes/2d/cpuparticles2d/godotRng.ts` reproduces the minimal
PCG32 generator (`pcg32_random_r` / `pcg32_srandom_r`), because CPUParticles2D's particle
layout IS that generator's output and a statistically-equivalent substitute would put
every particle somewhere else. Godot vendors the same implementation under
`thirdparty/misc/pcg.cpp`; it is by Melissa O'Neill and is licensed Apache-2.0, separately
from Godot's own MIT licence above.

```
Copyright 2014 Melissa O'Neill <oneill@pcg-random.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

---

## Godot demo projects (vendored test corpus)

<https://github.com/godotengine/godot-demo-projects>

The `scenes/demos/` tree is a vendored copy of the visual categories of
godot-demo-projects, used as a breadth corpus for previewer QA. Source commit, vendoring
procedure and the local modifications applied are recorded in `scenes/demos/README.md`,
which is generated by `scripts/vendor-godot-demos.mjs` (that script carries the copyright
line below because it emits this attribution, not because it is itself derived source).

Code is MIT under the same copyright as Godot Engine above. **Per-demo asset licences
vary and are frequently CC-BY**; each project keeps its own `README.md` with the specific
attribution, and those files are preserved by the vendoring script.
