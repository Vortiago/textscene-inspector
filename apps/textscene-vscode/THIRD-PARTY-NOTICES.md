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
| `packages/textscene-core/src/r3f/sky/skyShaders.ts` | `scene/resources/3d/sky_material.cpp` |
| `packages/textscene-core/src/resources/environment/godotToneMapping.ts` | `drivers/gles3/shaders/tonemap_inc.glsl` |
| `packages/textscene-core/src/resources/environment/godotGlow.ts` | `servers/rendering/renderer_rd/shaders/effects/copy.glsl` (`MODE_GLOW` bright pass under `FLAG_GLOW_FIRST_PASS`) and `.../effects/tonemap.glsl` (`gather_glow`, `apply_glow`, and `main()`'s pre/post-tonemap glow ordering) |
| `packages/textscene-core/src/utils/colorSpace.ts` | `core/math/color.h` (`Color::srgb_to_linear`) |
| `packages/textscene-core/src/resources/materials/standardmaterial3d/emission.ts` | `scene/resources/material.cpp` (`BaseMaterial3D::_update_shader` emission block, `set_emission_energy_multiplier`) |
| `packages/textscene-core/src/nodes/3d/csg/smoothNormals.ts` | `modules/csg/csg_shape.cpp` (`CSGShape3D::update_shape` normal accumulation, `flip_faces`) and `core/math/plane.h` (`Plane(p1, p2, p3)`) |
| `packages/textscene-core/src/nodes/3d/csg/csgbox3d/boxGeometry.ts` | `modules/csg/csg_shape.cpp` (`CSGBox3D::_build_brush`) |
| `packages/textscene-core/src/nodes/3d/csg/csgcylinder3d/cylinderGeometry.ts` | `modules/csg/csg_shape.cpp` (`CSGCylinder3D::_build_brush`) |
| `packages/textscene-core/src/nodes/3d/csg/csgsphere3d/sphereGeometry.ts` | `modules/csg/csg_shape.cpp` (`CSGSphere3D::_build_brush`) |
| `packages/textscene-core/src/nodes/3d/csg/csgpolygon3d/polygonGeometry.ts` | `modules/csg/csg_shape.cpp` (`CSGPolygon3D::_build_brush`) |
| `packages/textscene-core/src/nodes/3d/csg/csgtorus3d/torusGeometry.ts` | `modules/csg/csg_shape.cpp` (`CSGTorus3D::_build_brush`) |
| `packages/textscene-core/src/r3f/lighting2d/CanvasLighting2D.tsx` | `drivers/gles3/shaders/canvas.glsl` (the canvas light pass: `base_color`, `canvas_modulation`, the light loop) and `servers/rendering/renderer_canvas_cull.cpp` (`light->item_mask & ci->light_mask`) |
| `packages/textscene-core/src/r3f/lighting2d/canvasItemLighting.ts` | `drivers/gles3/shaders/canvas.glsl` (`MODE_UNSHADED` / `MODE_LIGHT_ONLY` guards, `light_only_alpha`) and `servers/rendering/renderer_canvas_cull.cpp` (the item cull-mask test) |
| `packages/textscene-core/src/r3f/lighting2d/lightQuad.ts` | `drivers/gles3/shaders/canvas.glsl` (`light_blend_compute`, `light_base_color` energy packing, `light_shadow_compute`'s PCF5/PCF13 tap kernels and the `shadow_pos` quadrant block) and `drivers/gles3/rasterizer_canvas_gles3.cpp` (`shadow_pixel_size`, `_update_shadow_atlas`'s atlas filter/wrap state) |
| `packages/textscene-core/src/r3f/lighting2d/lightCullKey.ts` | `drivers/gles3/rasterizer_canvas_gles3.cpp` (`_record_item_commands`'s per-item light test) and `servers/rendering/renderer_viewport.cpp` (`_draw_viewport`'s per-canvas `layer_min`/`layer_max` filter) |
| `packages/textscene-core/src/r3f/lighting2d/canvasItemPlacement.tsx` | `servers/rendering/renderer_canvas_cull.cpp` (`_cull_canvas_item`'s `z_relative` accumulation and CLAMP, `_attach_canvas_item_for_draw`'s `ci->z_final`) |
| `packages/textscene-core/src/r3f/lighting2d/shadowPolarMap.ts` | `drivers/gles3/rasterizer_canvas_gles3.cpp` (`RasterizerCanvasGLES3::light_update_shadow`'s four 90° projections and quadrant viewport packing, `occluder_polygon_set_shape`'s edge extrusion), `drivers/gles3/shaders/canvas_occlusion.glsl` (`depth = dot(direction, vtx.xy)`, `out_depth = depth / z_far`), `drivers/gles3/shaders/canvas.glsl` (the `pos_box` / `pos_rot` quadrant mapping) and `servers/rendering/renderer_viewport.cpp` (`radius_cache`, the `radius/1000` and `radius*1.1` clip planes) |
| `packages/textscene-core/src/r3f/controls/native/controlRectSolver.ts` | `scene/gui/control.cpp` (`Control::_size_changed`'s anchor/offset edge solve and its minimum-size floor with `GROW_DIRECTION_*`, `Control::get_combined_minimum_size`, `get_anchorable_rect`) |
| `packages/textscene-core/src/nodes/2d/ui/margincontainer/nativeSolver.ts` | `scene/gui/margin_container.cpp` (`MarginContainer::get_minimum_size`, `MarginContainer::_notification`'s `NOTIFICATION_SORT_CHILDREN`) and `scene/gui/container.cpp` (`Container::fit_child_in_rect`) |
| `packages/textscene-core/src/nodes/2d/ui/centercontainer/nativeSolver.ts` | `scene/gui/center_container.cpp` (`CenterContainer::get_minimum_size`, `CenterContainer::_notification`'s `NOTIFICATION_SORT_CHILDREN`) and `scene/gui/container.cpp` (`Container::fit_child_in_rect`) |
| `packages/textscene-core/src/nodes/2d/ui/shared/fitChildInRect.ts` | `scene/gui/container.cpp` (`Container::fit_child_in_rect`) and `scene/gui/control.h` (the `SizeFlags` bitmask, `Container::as_sortable_control`'s visibility test) |
| `packages/textscene-core/src/nodes/2d/ui/shared/boxContainerSolver.ts` | `scene/gui/box_container.cpp` (`BoxContainer::_resort`, `BoxContainer::get_minimum_size`) and `scene/gui/container.cpp` (`Container::fit_child_in_rect`) |
| `packages/textscene-core/src/nodes/2d/ui/gridcontainer/nativeSolver.ts` | `scene/gui/grid_container.cpp` (`GridContainer::_notification`'s `NOTIFICATION_SORT_CHILDREN` handler, `GridContainer::get_minimum_size`), `scene/gui/container.cpp` (`Container::fit_child_in_rect`, `Container::as_sortable_control`) and `scene/gui/control.cpp` (`Control::set_rect`/`Control::_size_changed`'s minimum-size floor, which every `fit_child_in_rect` call re-triggers) |
| `packages/textscene-core/src/nodes/2d/ui/panelcontainer/nativeSolver.ts` | `scene/gui/panel_container.cpp` (`PanelContainer::get_minimum_size`, `PanelContainer::_notification`'s `NOTIFICATION_SORT_CHILDREN` content-rect inset) and `scene/gui/container.cpp` (`Container::fit_child_in_rect`) |
| `packages/textscene-core/src/nodes/2d/ui/texturerect/nativeSolver.ts` | `scene/gui/texture_rect.cpp` (`TextureRect::get_minimum_size`'s `expand_mode` contribution, `TextureRect::_notification`'s `NOTIFICATION_DRAW` `stretch_mode` draw-rect math) and `scene/main/canvas_item.h` (`TextureFilter`/`TextureRepeat`) |
| `packages/textscene-core/src/r3f/controls/native/styleBoxFlatGeometry.ts` | `scene/resources/style_box_flat.cpp` (`StyleBoxFlat::draw`, `draw_rounded_rectangle`, `adapt_values`, `set_inner_corner_radius`, `set_corner_scale`; the non-anti-aliased branch) |
| `packages/textscene-core/src/r3f/controls/native/text/textLayout.ts` | `scene/gui/label.cpp` (`Label::_shape`'s autowrap flag mapping) and `servers/text/text_server.cpp` (`TextServer::shaped_text_get_line_breaks`'s width accumulation, safe-break bookkeeping and edge-space trimming) |
| `packages/textscene-core/src/resources/curve/sample.ts` | `scene/resources/curve.cpp` (`Curve::sample`, `Curve::sample_local_nocheck`, `Curve::get_index`) and `core/math/math_funcs.h` (`Math::bezier_interpolate`) |
| `packages/textscene-core/src/nodes/2d/cpuparticles2d/godotRng.ts` | `core/math/random_pcg.h` (`RandomPCG::seed`, `RandomPCG::randf`), `thirdparty/misc/pcg.cpp` (`pcg32_random_r`, `pcg32_srandom_r` — see the PCG note below) and `scene/2d/cpu_particles_2d.cpp` (`idhash`, `rand_from_seed`) |
| `packages/textscene-core/src/nodes/2d/cpuparticles2d/simulate.ts` | `scene/2d/cpu_particles_2d.cpp` (`CPUParticles2D::_particles_process`, the `_update_internal` preprocess loop, `_update_particle_data_buffer`) |
| `scripts/godot-ref/run.mjs` | `editor/plugins/node_3d_editor_plugin.cpp` (`Node3DEditor::_node_added` yield rule, `_load_default_preview_settings`, `_preview_settings_changed`, `Node3DEditorViewport::Cursor()`) |

### Reproduced values

Beyond the transcriptions above, property defaults, enum values, default colours and
editor constants are read from Godot source throughout the codebase and cited per file at
the point of use, for example `nodes/physics/shared/debugColor.ts`,
`resources/sky/parser.ts`, `resources/textures/gradienttexture2d/parser.ts`,
`resources/tileset/tilePlacement.ts` and `r3f/godotEditorCamera.ts`.

### Vendored theme icons

The native (WebGL) Control renderer's CheckBox and OptionButton painters need the same
indicator glyphs Godot's editor bakes into its built-in dark theme. Rather than redraw
approximations, `packages/textscene-core/src/r3f/controls/native/themeIcons.ts` embeds
unmodified copies of the actual SVG files, base64-encoded as `data:` URLs, from Godot
4.6.3's `scene/theme/icons/`:

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
