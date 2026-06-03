# Parity audit - expanded sweep progress (RESUMABLE)

Tracks the 46 confirmed Godot-fidelity divergences from the 2026-06-03 expanded audit (transforms/cameras/lights/Label3D/Sprite3D/Sprite2D/WorldEnvironment/2D-Control). Fix TDD red-first (use the godot-parity-audit skill conventions), commit per batch, then tick the batch + the finding `- [ ]` markers and commit. If a session crashes, resume from the first unchecked batch.

## Batch checklist

- [x] **B1 Environment** (4): #9 ambient_light_color (defau(H), #10 ambient_light_source(H), #11 FogExp2 (wrong fog system (H), #27 background_color / ambient(M)
- [x] **B2 Camera3D** (2): #1 size (OrthographicCamera f(H), #28 fov with keep_aspect = KEE(L)
- [ ] **B3 SpotLight3D** (2): #5 spot_attenuation(H), #15 spot_angle_attenuation(M)
- [ ] **B4 Label3D** (6): #2 billboard (default when ab(H), #3 pixel_size (default when a(H), #4 Label3D quad size formula (H), #13 outline_size (default when(M), #14 outline_size canvas lineWi(M), #33 double_sided(L)
- [ ] **B5 Sprite3D** (6): #7 flip_h(H), #17 offset(M), #18 flip_v(M), #19 centered(M), #39 double_sided(L), #40 transparent(L)
- [ ] **B6 Sprite2D/Animated** (3): #6 modulate (CanvasItem, inhe(H), #16 region_enabled + hframes/v(M), #38 self_modulate(L)
- [ ] **B7 StyleBox** (4): #8 content_margin_left/top/ri(H), #41 shadow_size / shadow_color(L), #42 border_color (default fall(L), #43 border_blend(L)
- [ ] **B8 TextureRect/ColorRect** (6): #22 stretch_mode = 1 (STRETCH_(M), #23 stretch_mode = 2 (STRETCH_(M), #24 stretch_mode = 3 (STRETCH_(M), #25 flip_h(M), #26 flip_v(M), #46 stretch_mode = 4 (STRETCH_(L)
- [ ] **B9 Text controls** (4): #20 autowrap_mode (AUTOWRAP_AR(M), #21 alignment(M), #44 uppercase(L), #45 fit_content(L)
- [ ] **B10 Control/Containers** (5): #12 size_flags_stretch_ratio(M), #29 size_flags_stretch_ratio(L), #30 GridContainer â€” child SI(L), #31 horizontal_scroll_mode / v(L), #32 GridContainer child size_f(L)
- [ ] **B11 Node2D/3D transforms** (4): #34 skew(L), #35 z_as_relative(L), #36 show_behind_parent(L), #37 top_level(L)

Dedup: stretch_ratio #12=#29; grid-expand #30=#32 -> fix once in B10 (~44 distinct). Document-only platform limits go to docs/PARITY-LIMITATIONS.md.

## Findings detail

### [#1] Camera3D.size (OrthographicCamera frustum bounds)  (HIGH / camera3d / wrong-mapping) - [x]
- Godot: Godot's Projection::set_orthogonal(size, aspect, near, far, flip_fov) divides size by 2 to get the half-dimension. With KEEP_HEIGHT (default, flip_fov=false): p_size is first multiplied by aspect, then left=-p_size/2, right=+p_size/2, bottom=-p_size/aspect/2, top=+p_size/aspect/2 â€” so halfHeight = size/2 and halfWidth = (size*aspect)/2. With KEEP_WIDTH (flip_fov=true): halfWi
- Ours: packages/textscene-core/src/nodes/3d/camera3d/Component.tsx:145-146 â€” when KEEP_HEIGHT: halfHeight = size, halfWidth = size * DEFAULT_ASPECT; when KEEP_WIDTH: halfHeight = size / DEFAULT_ASPECT, halfWidth = size. The code uses size directly as the half-dimension (radius), not as the full dimension (diameter).
- Fix: Divide size by 2 before using it as the half-dimension. In Component.tsx line 145-146 change to: const halfHeight = isKeepWidth ? (size / DEFAULT_ASPECT) / 2 : size / 2; const halfWidth = isKeepWidth ? size / 2 : (size * DEFAULT_ASPECT) / 2; Update test #65 to expect o.top === 2 (not 4) for size=4.

### [#2] Label3D.billboard (default when absent)  (HIGH / label3d / wrong-default) - [ ]
- Godot: Godot 4.4 Label3D.billboard default is 0 (BILLBOARD_DISABLED). Source: https://github.com/godotengine/godot/blob/master/doc/classes/Label3D.xml â€” `<member name="billboard" ... default="0">`.
- Ours: packages/textscene-core/src/nodes/3d/label3d/parser.ts:36 â€” when `properties.billboard` is undefined the parser returns `BillboardMode.BILLBOARD_ENABLED` (1).
- Fix: Change the fallback in parseBillboardMode: `if (value === undefined) return BillboardMode.BILLBOARD_DISABLED;`

### [#3] Label3D.pixel_size (default when absent)  (HIGH / label3d / wrong-default) - [ ]
- Godot: Godot 4.4 Label3D.pixel_size default is 0.005. Source: https://github.com/godotengine/godot/blob/master/doc/classes/Label3D.xml â€” `<member name="pixel_size" ... default="0.005">`. The Godot stable docs also confirm: "pixel_size = 0.005".
- Ours: packages/textscene-core/src/nodes/3d/label3d/parser.ts:20 â€” `parseFloat(properties.pixel_size ?? '0.01')` â€” fallback is 0.01, twice the Godot default.
- Fix: Change the fallback to `'0.005'`: `parseFloat(properties.pixel_size ?? '0.005')`.

### [#4] Label3D quad size formula (pixel_size Ã— canvas dimensions)  (HIGH / label3d / wrong-mapping) - [ ]
- Godot: Godot renders each glyph quad where world size = glyph_texture_pixels Ã— pixel_size. From label_3d.cpp: `gl_sz = TS->font_get_glyph_size(...) * pixel_size`. The entire label plane therefore measures `canvas_width_pixels Ã— pixel_size` by `canvas_height_pixels Ã— pixel_size` in world units.
- Ours: packages/textscene-core/src/nodes/3d/label3d/Component.tsx:155-158 â€” `const height = properties.pixel_size * 100 * fontScale` where `fontScale = fontSize / 128`. The magic constant 100 has no relationship to the actual canvas pixel dimensions (`canvas.height = fontSize + 20`).
- Fix: Replace the height formula: `const height = canvas.height * properties.pixel_size;` and `const width = canvas.width * properties.pixel_size;`. The aspect ratio is implicit since both dimensions use the same pixel_size multiplier.

### [#5] SpotLight3D.spot_attenuation  (HIGH / lights-3d / wrong-mapping) - [ ]
- Godot: spot_attenuation is the distance falloff exponent in Godot's formula (1-(d/range)^4)^2 * d^(-spot_attenuation), identical in role to omni_attenuation. Default = 1.0. Higher values concentrate light near the source. Source: scene_forward_lights_inc.glsl get_omni_attenuation(); Godot 4.4 SpotLight3D docs: 'controls the distance attenuation function'.
- Ours: packages/textscene-core/src/nodes/3d/lights/spotlight3d/Component.tsx:31-37 â€” spot_attenuation is read via an 'as unknown' cast, clamped to [0,1], and used as SpotLight.penumbra (edge softness). The distance decay prop is hardcoded to 2 (line 57). The property is never stored in SpotLight3DProperties (types.ts) or parsed by parseSpotLight3D (parser.ts).
- Fix: Parse spot_attenuation in parseSpotLight3D (parser.ts) and add it to SpotLight3DProperties. In Component.tsx: set decay={properties.spot_attenuation ?? 1.0} (mirrors the omni_attenuationâ†’decay mapping). For edge softness, parse spot_angle_attenuation and derive penumbra; the simplest approximation is penumbra = 1 / Math.max(spot_angle_attenuation, 1) clamped to [0,1] (higher Godot exponent = sharper edge = lower penumbra). Remove the existing clamped-attenuation-as-penumbra

### [#6] Sprite2D.modulate (CanvasItem, inherited)  (HIGH / sprite2d-animated / wrong-mapping) - [ ]
- Godot: Godot stores Color(r,g,b,a) values in TSCN in sRGB space (matching the Godot inspector colour picker which operates in sRGB). The 2D canvas renderer converts to linear internally before compositing. Godot 4.x docs: CanvasItem.modulate default Color(1,1,1,1). The Decal-modulate fix PR #89849 confirms that TSCN colour scalars are sRGB and must be converted to linear before passin
- Ours: packages/textscene-core/src/nodes/2d/sprite2d/Component.tsx:62-65 â€” `new THREE.Color(modulate.r, modulate.g, modulate.b)` passes the raw parsed floats as the THREE.Color constructor arguments. With three.js ColorManagement enabled (the R3F default), THREE.Color(r,g,b) treats its arguments as already-linear values; no sRGBâ†’linear conversion is applied. The same bug is presen
- Fix: Before constructing the THREE.Color, convert each channel with the same sRGBChannelToLinear helper used by standardMaterialScalars.ts. Apply the conversion to `multiplyModulate`'s result (or at the point where the per-node modulate is first parsed), so every downstream THREE.Color is in linear space. The alpha channel is not affected (opacity is a linear blend weight in both engines).

### [#7] SpriteBase3D.flip_h  (HIGH / sprite3d / missing) - [ ]
- Godot: SpriteBase3D.flip_h (bool, default false) mirrors the texture horizontally. Godot source: `if (is_flipped_h()) { SWAP(uvs[0], uvs[1]); SWAP(uvs[2], uvs[3]); }` â€” swaps left/right UV coordinates on the quad without changing vertex positions.
- Ours: packages/textscene-core/src/nodes/3d/sprite3d/parser.ts â€” flip_h is not parsed. packages/textscene-core/src/nodes/3d/sprite3d/Component.tsx â€” flip_h is not applied. packages/textscene-core/src/nodes/3d/sprite3d/linterParser.ts â€” flip_h is not registered as a known property.
- Fix: Parse flip_h as a bool in parser.ts and linterParser.ts. In composeTexture (Component.tsx), after applying UV offset/repeat, negate texture.repeat.x (set it to -1/H) and adjust texture.offset.x by +1/H to implement a horizontal mirror. Alternatively apply `texture.repeat.set(-1/H, 1/V); texture.offset.x += 1/H` when flip_h is true.

### [#8] StyleBoxFlat.content_margin_left/top/right/bottom (negative â†’ border_width fallback)  (HIGH / stylebox / wrong-mapping) - [ ]
- Godot: StyleBox::get_margin() (scene/resources/style_box.cpp, Godot 4.4): when content_margin[side] < 0, returns get_style_margin(side). StyleBoxFlat::get_style_margin() (scene/resources/style_box_flat.cpp) returns border_width[side]. So with default content_margin = -1 and border_width = 2, effective content padding = 2px per side. Docs: https://docs.godotengine.org/en/4.4/classes/cl
- Ours: packages/textscene-core/src/r3f/controls/styleBoxToCss.ts:58-63 â€” reads each content_margin with fallback -1, then applies Math.max(0, value). When all four content_margin keys are absent (the common case when only border_width is set), the condition cl>=0||ct>=0||cr>=0||cb>=0 is false and NO padding is emitted. Even if only some sides are present, the absent sides get 0 inst
- Fix: In the content_margin block, replace the fallback with the border_width value for each side when the margin is negative: const cl = n(data.content_margin_left, -1); const effectiveL = cl >= 0 ? cl : bwL; (repeat per side). Compute bwL/bwT/bwR/bwB before the margin block and reuse them.

### [#9] Environment.ambient_light_color (default)  (HIGH / worldenvironment / wrong-default) - [x]
- Godot: Godot 4.x default for ambient_light_color is Color(0,0,0,1) â€” black, meaning zero ambient contribution when the property is absent from the TSCN file. Ref: https://docs.godotengine.org/en/stable/classes/class_environment.html â€” 'ambient_light_color (Color, default: Color(0, 0, 0, 1))'.
- Ours: packages/textscene-core/src/resources/environment/parser.ts:22-23 â€” when properties.ambient_light_color is absent the fallback is { r: 1, g: 1, b: 1, a: 1 } (white).
- Fix: Change the fallback in parser.ts line 23 to { r: 0, g: 0, b: 0, a: 1 } to match Godot's documented default.

### [#10] Environment.ambient_light_source  (HIGH / worldenvironment / missing) - [x]
- Godot: Godot 4.x Environment.ambient_light_source controls whether ambient light is drawn from the background (AMBIENT_SOURCE_BG = 0, the default), disabled (AMBIENT_SOURCE_DISABLED = 1), a flat color (AMBIENT_SOURCE_COLOR = 2), or the sky regardless of background (AMBIENT_SOURCE_SKY = 3). With the default AMBIENT_SOURCE_BG the ambient_light_color and ambient_light_energy properties h
- Ours: packages/textscene-core/src/resources/environment/types.ts â€” ambient_light_source is absent from EnvironmentProperties entirely. packages/textscene-core/src/resources/environment/parser.ts â€” the property is never read. packages/textscene-core/src/nodes/3d/worldenvironment/Component.tsx:36-45 â€” an ambientLight is always emitted whenever settings.ambient exists (which it al
- Fix: Add ambient_light_source to EnvironmentProperties (enum values 0-3), parse it in parser.ts, and gate the ambientLight emission in Component.tsx: only emit the AmbientLight when source is AMBIENT_SOURCE_COLOR (2) or AMBIENT_SOURCE_SKY (3, approximate with flat color). For source = BG (0) or DISABLED (1) skip the AmbientLight entirely.

### [#11] Environment.volumetric_fog â€” applied as THREE.FogExp2 (wrong fog system and wrong density scale)  (HIGH / worldenvironment / wrong-mapping) - [x]
- Godot: Godot 4 has two separate fog systems. (1) Screen-space fog: enabled by fog_enabled (default false), with properties fog_light_color (default Color(0.518,0.553,0.608,1)), fog_density (default 0.01), fog_mode (FOG_MODE_EXPONENTIAL=0 or FOG_MODE_DEPTH=1). (2) Volumetric fog: enabled by volumetric_fog_enabled (default false), a froxel-based 3D scattering effect. volumetric_fog_dens
- Ours: packages/textscene-core/src/resources/environment/parser.ts:27-34 â€” reads volumetric_fog_* properties only; the screen-space fog_enabled / fog_density / fog_light_color properties are not parsed at all. packages/textscene-core/src/nodes/3d/worldenvironment/Component.tsx:82-85 â€” applies the volumetric fog data as THREE.FogExp2 with the volumetric density value (e.g. 0.05) pa
- Fix: Parse the screen-space fog properties (fog_enabled, fog_light_color, fog_density, fog_mode) and use those to drive THREE.FogExp2 (for FOG_MODE_EXPONENTIAL) or THREE.Fog (for FOG_MODE_DEPTH) since they are the closest equivalent. Godot's volumetric_fog has no direct THREE.js equivalent; it should be treated as kind=missing rather than approximated with the wrong system and wrong density scale.

### [#12] Control.size_flags_stretch_ratio  (MEDIUM / control-layout / wrong-mapping) - [ ]
- Godot: When multiple Control children in a BoxContainer all have SIZE_EXPAND set, Godot divides the remaining space proportionally according to each child's size_flags_stretch_ratio (default 1.0). A child with ratio 2.0 receives twice as much space as one with 1.0. Documented at https://docs.godotengine.org/en/4.4/classes/class_control.html#class-control-property-size-flags-stretch-ra
- Ours: packages/textscene-core/src/r3f/controls/controlLayout.ts:114 â€” `style.flexGrow = mainFlag !== undefined && (mainFlag & SIZE_FLAG_EXPAND) !== 0 ? 1 : 0`. The value is always 1 for any EXPAND child. size_flags_stretch_ratio is not present in ControlProperties (packages/textscene-core/src/nodes/2d/ui/control/types.ts) and is not parsed in the control parser (packages/textscene-
- Fix: Add `sizeFlagsStretchRatio?: number` to ControlProperties, parse `size_flags_stretch_ratio` in parseControl(), and change controlLayout.ts line 114 to: `style.flexGrow = mainFlag !== undefined && (mainFlag & SIZE_FLAG_EXPAND) !== 0 ? (props.sizeFlagsStretchRatio ?? 1) : 0`.

### [#13] Label3D.outline_size (default when absent)  (MEDIUM / label3d / wrong-default) - [ ]
- Godot: Godot 4.4 Label3D.outline_size default is 12. Source: https://github.com/godotengine/godot/blob/master/doc/classes/Label3D.xml â€” `<member name="outline_size" ... default="12">`. The docs also state: "Text outline size." default 12.
- Ours: packages/textscene-core/src/nodes/3d/label3d/parser.ts:23 â€” `parseFloat(properties.outline_size ?? '0')` â€” fallback is 0, so no outline is drawn unless explicitly set.
- Fix: Change the fallback to `'12'`: `parseFloat(properties.outline_size ?? '12')`.

### [#14] Label3D.outline_size canvas lineWidth scaling  (MEDIUM / label3d / wrong-mapping) - [ ]
- Godot: outline_size is measured in font pixels at the configured font_size resolution. From label_3d.cpp the value is passed directly to the TextServer as a font-pixel measurement alongside font_size: `Vector2i(p_glyph.font_size, p_outline_size)`. A value of 12 means a 12-font-pixel-wide stroke at whatever font_size is active.
- Ours: packages/textscene-core/src/nodes/3d/label3d/Component.tsx:138 â€” `context.lineWidth = properties.outline_size * 10`. The factor of 10 is arbitrary; since the canvas is already drawn at fontSize pixels (matching the Godot font_size), the canvas lineWidth should equal outline_size directly (1 canvas px = 1 font px).
- Fix: Change to `context.lineWidth = properties.outline_size;`. If the internal canvas resolution is intentionally upscaled relative to Godot font_size (e.g. using DEFAULT_FONT_SIZE=128 when Godot font_size=32), then scale proportionally: `context.lineWidth = properties.outline_size * (fontSize / godotFontSize)`, but that requires storing the Godot font_size separately from the canvas render size.

### [#15] SpotLight3D.spot_angle_attenuation  (MEDIUM / lights-3d / missing) - [ ]
- Godot: spot_angle_attenuation controls the angular cone edge falloff via pow(spot_rim, spot_angle_attenuation). Default = 1.0. Large values (e.g. 8) give a very hard cone edge; values near 0 give very gradual falloff across the whole cone. Source: scene_forward_lights_inc.glsl cone attenuation section; Godot 4.4 SpotLight3D docs.
- Ours: packages/textscene-core/src/nodes/3d/lights/spotlight3d/parser.ts â€” not parsed. packages/textscene-core/src/nodes/3d/lights/spotlight3d/types.ts â€” not in SpotLight3DProperties. packages/textscene-core/src/nodes/3d/lights/spotlight3d/Component.tsx â€” never consumed. The linter (linterParser.ts) validates it but the renderer ignores it entirely.
- Fix: Parse spot_angle_attenuation in parseSpotLight3D; add to SpotLight3DProperties. Map to penumbra via an inverse relationship: larger Godot exponent = harder edge = smaller penumbra. A reasonable approximation: penumbra = Math.max(0, 1 - (spot_angle_attenuation / 8)) clamped to [0,1] so that the Godot default of 1.0 yields penumbraâ‰ˆ0.875 (very soft) and 8+ yields penumbra=0 (hard edge). This is approximate but captures the direction of the parameter.

### [#16] Sprite2D.region_enabled + hframes/vframes combined  (MEDIUM / sprite2d-animated / wrong-mapping) - [ ]
- Godot: Godot's Sprite2D._get_rects() always computes base_rect first (region_rect when region_enabled, else full texture), then subdivides it: frame_size = base_rect.size / Size2(hframes, vframes). The two features are additive: region_rect selects a sub-atlas, and hframes/vframes tile that sub-atlas into frames. Source: sprite_2d.cpp _get_rects() lines ~64-104 (fetched from raw.githu
- Ours: packages/textscene-core/src/nodes/2d/sprite2d/Component.tsx:156-160 â€” `composeTexture` uses an `else if`: if `region_enabled && region_rect` it calls `applyRegionRect` and skips sprite-sheet UV; if `hframes > 1 || vframes > 1` (but NOT region_enabled) it calls `applySpritesheetUV`. Similarly, `computeQuadSize` at lines 200-204 returns `region_rect.size` directly when region_e
- Fix: Remove the `else if` in `composeTexture`: when `region_enabled` apply `applyRegionRect` first, then always check `hframes > 1 || vframes > 1` and subdivide relative to the already-applied region UV (i.e. repeat and offset compose multiplicatively). In `computeQuadSize`, when region_enabled also divide by hframes/vframes: `{ width: region_rect.width / hframes, height: region_rect.height / vframes }`.

### [#17] SpriteBase3D.offset  (MEDIUM / sprite3d / missing) - [ ]
- Godot: SpriteBase3D.offset (Vector2, default (0,0)) is a pixel-space offset applied to the quad position before scaling by pixel_size. Godot source (sprite_3d.cpp get_item_rect): `ofs = get_offset(); if (is_centered()) ofs -= s / 2; return Rect2(ofs, s);` â€” the offset shifts the quad relative to the node origin in pixel space. World displacement = offset * pixel_size.
- Ours: packages/textscene-core/src/nodes/3d/sprite3d/parser.ts:55 â€” offset is parsed into `properties.offset`. packages/textscene-core/src/nodes/3d/sprite3d/Component.tsx (entire file) â€” `properties.offset` is never read; the mesh `position` only comes from the node transform and no additional displacement is applied to the quad.
- Fix: In computeQuadSize (or a separate helper), compute world offset as `{ x: properties.offset.x * properties.pixel_size, y: -properties.offset.y * properties.pixel_size }` (Godot screen-Y is down, three.js Y is up). Apply this as an additional position on the `<mesh>` alongside the node transform position, or as a `<group>` child offset.

### [#18] SpriteBase3D.flip_v  (MEDIUM / sprite3d / missing) - [ ]
- Godot: SpriteBase3D.flip_v (bool, default false) mirrors the texture vertically. Godot source: `if (is_flipped_v()) { SWAP(uvs[0], uvs[3]); SWAP(uvs[1], uvs[2]); }` â€” swaps top/bottom UV coordinates.
- Ours: packages/textscene-core/src/nodes/3d/sprite3d/parser.ts â€” flip_v is not parsed. packages/textscene-core/src/nodes/3d/sprite3d/Component.tsx â€” flip_v is not applied.
- Fix: Parse flip_v as a bool in parser.ts and linterParser.ts. In composeTexture, negate texture.repeat.y and adjust texture.offset.y to implement a vertical mirror: `texture.repeat.y = -1/V; texture.offset.y += 1/V` when flip_v is true.

### [#19] SpriteBase3D.centered  (MEDIUM / sprite3d / missing) - [ ]
- Godot: SpriteBase3D.centered (bool, default true). When false, the quad origin shifts to the top-left corner of the sprite region instead of the center. Godot source (get_item_rect): `if (is_centered()) ofs -= s / 2;` â€” centering subtracts half the frame size from the offset, so disabling it means the quad's top-left corner sits at the node position.
- Ours: packages/textscene-core/src/nodes/3d/sprite3d/parser.ts â€” centered is not parsed. packages/textscene-core/src/nodes/3d/sprite3d/Component.tsx:167 â€” `<planeGeometry args={[width, height]} />` always produces a centered plane (three.js planeGeometry is always centered at origin). No corner-origin offset is ever applied.
- Fix: Parse centered as a bool (default true) in parser.ts and linterParser.ts. In the Component, when centered=false, apply an additional mesh-level position offset of (+width/2, -height/2, 0) in local space (i.e., wrap the planeGeometry in a group or use a geometry translate).

### [#20] Label.autowrap_mode (AUTOWRAP_ARBITRARY = 1)  (MEDIUM / text-controls / wrong-mapping) - [ ]
- Godot: TextServer.AUTOWRAP_ARBITRARY (value 1) breaks lines at ANY position, including mid-word, useful when space is very limited. AUTOWRAP_WORD (2) breaks only at word boundaries. AUTOWRAP_WORD_SMART (3) breaks at words but force-breaks a single word that does not fit in one line. Godot 4.4 docs: https://docs.godotengine.org/en/4.4/classes/class_label.html (autowrap_mode property); 
- Ours: packages/textscene-core/src/nodes/2d/ui/label/Component.tsx:31 â€” `style.whiteSpace = props.autowrapMode ? 'pre-line' : 'pre'`. All non-zero values (ARBITRARY=1, WORD=2, WORD_SMART=3) collapse to `white-space: pre-line`. CSS `pre-line` wraps at word boundaries only, identical to WORD. ARBITRARY is never mapped to `word-break: break-all`; WORD_SMART is never mapped to `overflow
- Fix: In Label/Component.tsx replace the single boolean branch with a three-way map: mode 0 â†’ `white-space: pre` (no wrap, existing); mode 1 (ARBITRARY) â†’ `white-space: pre-wrap; word-break: break-all`; mode 2 (WORD) â†’ `white-space: pre-wrap`; mode 3 (WORD_SMART) â†’ `white-space: pre-wrap; overflow-wrap: break-word`.

### [#21] Button.alignment  (MEDIUM / text-controls / wrong-mapping) - [ ]
- Godot: Button.alignment (HorizontalAlignment) controls where the button text sits inside the button box. Default = 1 (CENTER). Values: 0=LEFT, 1=CENTER, 2=RIGHT. Godot 4.4 docs: https://docs.godotengine.org/en/4.4/classes/class_button.html (alignment property, default 1).
- Ours: packages/textscene-core/src/nodes/2d/ui/button/Component.tsx:37-40 â€” `justifyContent: 'center'` and `textAlign: 'center'` are hardcoded unconditionally in the style object. The parsed `props.alignment` (Button/parser.ts:16 â€” `result.alignment = parseOptionalInt(properties.alignment)`) is never read in Component.tsx.
- Fix: In Button/Component.tsx, define an alignment map `['flex-start', 'center', 'flex-end']` (matching LEFT/CENTER/RIGHT), then replace the hardcoded `justifyContent: 'center'` and `textAlign: 'center'` with values derived from `props.alignment ?? 1`. Update both `justifyContent` (for the flex container) and `textAlign` (for text nodes).

### [#22] TextureRect.stretch_mode = 1 (STRETCH_TILE)  (MEDIUM / texturerect-colorrect / wrong-mapping) - [ ]
- Godot: STRETCH_TILE repeats the texture as tiles across the full bounding rectangle (like CSS background-repeat: repeat). Godot 4.4 docs: 'Tile inside the node's bounding rectangle.' Source: https://docs.godotengine.org/en/4.4/classes/class_texturerect.html
- Ours: packages/textscene-core/src/nodes/2d/ui/texturerect/Component.tsx:144-152 â€” stretchObjectFit() default branch returns 'contain', so mode 1 is treated identically to KEEP_ASPECT_CENTERED. The <img> element cannot tile; a tiling rect needs a background-image approach.
- Fix: Switch the TextureRect component to render a <div> with background-image + background-repeat: repeat (using the data-URL) when stretchMode === 1, instead of an <img> with object-fit.

### [#23] TextureRect.stretch_mode = 2 (STRETCH_KEEP)  (MEDIUM / texturerect-colorrect / wrong-mapping) - [ ]
- Godot: STRETCH_KEEP draws the texture at its natural pixel size, positioned at the top-left of the control's bounding rect. Portions extending beyond the rect are clipped. Godot 4.4 docs: 'The texture keeps its original size and stays in the bounding rectangle's top-left corner.' Confirmed in texture_rect.cpp: size = texture->get_size(), offset = (0,0).
- Ours: packages/textscene-core/src/nodes/2d/ui/texturerect/Component.tsx:144-152 â€” default branch returns object-fit: 'contain'. The <img> is also forced to width/height: 100% (line 133-134), so the image scales to fit the container with letter-boxing. No objectPosition is set so it centers (CSS default 50% 50%).
- Fix: Add case 2 to stretchObjectFit returning 'none', and in textureRectFit add objectPosition: 'top left' for stretchMode === 2. object-fit: none on an img with width/height 100% renders at intrinsic size clipped to the box.

### [#24] TextureRect.stretch_mode = 3 (STRETCH_KEEP_CENTERED)  (MEDIUM / texturerect-colorrect / wrong-mapping) - [ ]
- Godot: STRETCH_KEEP_CENTERED draws the texture at its natural pixel size, centered within the bounding rect, clipped at the edges. Godot 4.4 docs: 'The texture keeps its original size and stays centered in the node's bounding rectangle.' Confirmed in texture_rect.cpp: offset = (get_size() - texture->get_size()) / 2, no scale applied.
- Ours: packages/textscene-core/src/nodes/2d/ui/texturerect/Component.tsx:137-139 sets objectPosition: 'center'; Component.tsx:150-151 (default branch) sets objectFit: 'contain'. object-fit: contain SCALES the image to fit â€” it does not preserve natural pixel size.
- Fix: Add case 3 to stretchObjectFit returning 'none'. The existing objectPosition: 'center' for mode 3 is already correct and should be kept.

### [#25] TextureRect.flip_h  (MEDIUM / texturerect-colorrect / missing) - [ ]
- Godot: When true, the texture is flipped horizontally. Godot 4.4 docs: 'If true, texture is flipped horizontally.' Default: false. Source: https://docs.godotengine.org/en/4.4/classes/class_texturerect.html
- Ours: packages/textscene-core/src/nodes/2d/ui/texturerect/parser.ts:1-19 â€” flip_h is never read from the heading properties. packages/textscene-core/src/nodes/2d/ui/texturerect/types.ts:1-10 â€” TextureRectProperties has no flipH field. Component.tsx â€” no transform applied for flipping.
- Fix: Add flipH?: boolean and flipV?: boolean to TextureRectProperties (types.ts). Parse them in parser.ts as parseOptionalBool. In Component.tsx apply transform: scaleX(-1) / scaleY(-1) on the <img> style when the flags are set.

### [#26] TextureRect.flip_v  (MEDIUM / texturerect-colorrect / missing) - [ ]
- Godot: When true, the texture is flipped vertically. Godot 4.4 docs: 'If true, texture is flipped vertically.' Default: false. Source: https://docs.godotengine.org/en/4.4/classes/class_texturerect.html
- Ours: packages/textscene-core/src/nodes/2d/ui/texturerect/parser.ts:1-19 â€” flip_v is never read. packages/textscene-core/src/nodes/2d/ui/texturerect/types.ts:1-10 â€” no flipV field. Component.tsx â€” no vertical flip transform.
- Fix: Same as flip_h â€” add flipV?: boolean to types, parse in parser.ts, apply transform: scaleY(-1) on the <img> style. The two flags combine multiplicatively, so both can be expressed as a single transform: scale(flipH ? -1 : 1, flipV ? -1 : 1).

### [#27] Environment.background_color / ambient_light_color (color space)  (MEDIUM / worldenvironment / wrong-mapping) - [x]
- Godot: Godot stores Color(r,g,b,a) values in sRGB color space. From Godot's Color class docs: 'the red, green, and blue properties are expected to be encoded using the nonlinear sRGB transfer function.' Physical lighting uses linear internally, but the serialised Color literals in TSCN files are sRGB-encoded. Ref: https://docs.godotengine.org/en/stable/classes/class_color.html.
- Ours: packages/textscene-core/src/nodes/3d/worldenvironment/Component.tsx:66 â€” scene.background = new THREE.Color(c.r, c.g, c.b); packages/textscene-core/src/nodes/3d/worldenvironment/Component.tsx:38-42 â€” color={new THREE.Color(settings.ambient.color.r, settings.ambient.color.g, settings.ambient.color.b)}. Both calls use the three-float constructor, which assumes Linear-sRGB inp
- Fix: Replace new THREE.Color(c.r, c.g, c.b) with new THREE.Color().setRGB(c.r, c.g, c.b, THREE.SRGBColorSpace) at Component.tsx:66 and Component.tsx:38-42, so three.js performs the correct sRGB-to-linear conversion before the color is passed to the renderer.

### [#28] Camera3D.fov with keep_aspect = KEEP_WIDTH (perspective projection)  (LOW / camera3d / wrong-mapping) - [x]
- Godot: When keep_aspect=KEEP_WIDTH (value 0), Godot passes p_flip_fov=true to Projection::set_perspective, which converts the stored fov by calling get_fovy(fov, 1.0/aspect). This means the tscn fov value is interpreted as the HORIZONTAL field of view and the vertical fov is derived from it. Source: Camera3D._get_camera_projection in scene/3d/camera_3d.cpp: 'cm.set_perspective(fov, vi
- Ours: packages/textscene-core/src/nodes/3d/camera3d/Component.tsx:115 â€” fov={properties.fov} is passed directly to THREE.PerspectiveCamera.fov regardless of keep_aspect mode. No conversion is applied when keep_aspect=KEEP_WIDTH.
- Fix: When keep_aspect === KeepAspectMode.KEEP_WIDTH, convert the horizontal fov to vertical before passing to THREE.PerspectiveCamera: const effectiveFov = properties.keep_aspect === KeepAspectMode.KEEP_WIDTH ? (2 * Math.atan(Math.tan((properties.fov * Math.PI / 180) / 2) / DEFAULT_ASPECT) * 180 / Math.PI) : properties.fov; then use effectiveFov in the perspectiveCamera element. This mirrors Godot's get_fovy(fov, 1.0/aspect) conversion.

### [#29] Control.size_flags_stretch_ratio  (LOW / containers / missing) - [ ]
- Godot: When multiple children of a BoxContainer all have SIZE_EXPAND set, available space is distributed proportionally by each child's `size_flags_stretch_ratio` (float, default 1.0). A child with ratio 2.0 receives twice the extra space of one with ratio 1.0. Godot docs: https://docs.godotengine.org/en/stable/classes/class_control.html#class-control-property-size-flags-stretch-ratio
- Ours: packages/textscene-core/src/r3f/controls/controlLayout.ts:114 â€” `style.flexGrow = mainFlag !== undefined && (mainFlag & SIZE_FLAG_EXPAND) !== 0 ? 1 : 0` â€” all EXPAND children unconditionally receive flex-grow:1 regardless of any stretch ratio. The property is never parsed (absent from control/parser.ts and control/types.ts).
- Fix: Add `sizeFlagsStretchRatio?: number` to ControlProperties. Parse `size_flags_stretch_ratio` as a float in control/parser.ts. In controlLayout.ts containerChildStyle, emit `flexGrow: props.sizeFlagsStretchRatio ?? 1` instead of the hard-coded 1 when the EXPAND bit is set.

### [#30] GridContainer â€” child SIZE_EXPAND does not widen columns  (LOW / containers / wrong-mapping) - [ ]
- Godot: Godot's GridContainer collects which columns contain at least one child with the horizontal SIZE_EXPAND flag, then distributes the remaining horizontal space equally among those columns (col_expand = remaining_space / expanded_column_count). Source: https://github.com/godotengine/godot/blob/master/scene/gui/grid_container.cpp. Same logic applies vertically.
- Ours: packages/textscene-core/src/nodes/2d/ui/gridcontainer/Component.tsx:17 â€” `gridTemplateColumns: repeat(${props.columns ?? 1}, max-content)`. max-content columns are sized to their widest child and never grow beyond that. packages/textscene-core/src/r3f/controls/controlLayout.ts:107-136 â€” containerChildStyle for parent==='grid' only returns `{ position:'relative' }` with no f
- Fix: Change gridTemplateColumns to mix `1fr` for columns that have an EXPAND child and `max-content` for the rest. Because column EXPAND membership requires inspecting child nodes at render time, the simplest safe fix is to default to `repeat(N, 1fr)` (equal columns fill available width), which matches Godot's equal-distribution for all-EXPAND grids and avoids the max-content shrinkage.

### [#31] ScrollContainer.horizontal_scroll_mode / vertical_scroll_mode  (LOW / containers / missing) - [ ]
- Godot: ScrollContainer exposes `horizontal_scroll_mode` and `vertical_scroll_mode` (ScrollMode enum: 0=SCROLL_MODE_DISABLED, 1=SCROLL_MODE_AUTO default, 2=SHOW_ALWAYS, 3=SHOW_NEVER, 4=RESERVE). When a mode is DISABLED (0), scrolling in that axis is completely off â€” the content is clipped and cannot be scrolled. Godot docs: https://docs.godotengine.org/en/stable/classes/class_scrollc
- Ours: packages/textscene-core/src/nodes/2d/ui/scrollcontainer/Component.tsx:13 â€” `useStyle: () => ({ overflow: 'auto' })` hard-codes bidirectional auto-scrolling. packages/textscene-core/src/nodes/2d/ui/scrollcontainer/parser.ts:10-15 â€” parseScrollContainer delegates to parseControl, which never reads horizontal_scroll_mode or vertical_scroll_mode.
- Fix: Add `horizontalScrollMode?: number` and `verticalScrollMode?: number` to a ScrollContainerProperties type. Parse them in scrollcontainer/parser.ts. In Component.tsx map mode 0â†’'hidden', mode 1â†’'auto', mode 2/4â†’'scroll', mode 3â†’'hidden' (with a note that SHOW_NEVER hides the bar but keeps scrolling â€” use `overflow:scroll; scrollbar-width:none` for that). Emit `overflowX` and `overflowY` separately.

### [#32] GridContainer child size_flags_horizontal (EXPAND columns)  (LOW / control-layout / wrong-mapping) - [ ]
- Godot: Godot's GridContainer computes each column width independently as the max min-size of all children in that column (equivalent to CSS max-content). When any child in a column has SIZE_EXPAND set horizontally, that column is marked as expandable and the remaining container width (after fixed columns and h_separation) is distributed among expandable columns. Source: https://github
- Ours: packages/textscene-core/src/nodes/2d/ui/gridcontainer/Component.tsx:18 â€” `gridTemplateColumns: repeat(${props.columns ?? 1}, max-content)`. All columns unconditionally use max-content; no child size_flags are inspected. containerChildStyle() in controlLayout.ts returns only `{ position: 'relative' }` for grid-parented children (lines 107-136 have no 'grid' branch), so size_fl
- Fix: When building the GridContainer, collect the size_flags_horizontal of each child by column position (child index mod columns). For columns that contain at least one child with SIZE_EXPAND, use '1fr' in the template string instead of 'max-content'. Example: build an array of N column strings and join: `gridTemplateColumns: columnStrings.join(' ')`. No current scene is affected (no EXPAND grid children exist in the shipped .tscn files).

### [#33] Label3D.double_sided  (LOW / label3d / missing) - [ ]
- Godot: Godot 4.4 Label3D.double_sided (default true) controls back-face culling. When false, the label is invisible when viewed from behind. Source: https://docs.godotengine.org/en/4.4/classes/class_label3d.html â€” "If true, text can be seen from the back as well, if false, it is invisible when looking at it from behind."
- Ours: packages/textscene-core/src/nodes/3d/label3d/Component.tsx:105 â€” `side={THREE.DoubleSide}` is hardcoded. The property is not in types.ts and not parsed. When a TSCN explicitly sets double_sided = false, the label still renders from both sides.
- Fix: Add double_sided: boolean (default true) to Label3DProperties, parse it, and map to `side={properties.double_sided ? THREE.DoubleSide : THREE.FrontSide}`.

### [#34] Node2D.skew  (LOW / node2d-transform / wrong-mapping) - [ ]
- Godot: Godot 4.x docs: Node2D.skew (float, radians, default 0.0) is a shear applied between rotation and scale via Transform2D.set_rotation_scale_and_skew(). The Y-axis column of the local Transform2D is rotated by (rotation + skew) while the X-axis column is rotated by rotation only, producing a visible parallelogram distortion. Ref: https://docs.godotengine.org/en/4.4/classes/class_
- Ours: packages/textscene-core/src/nodes/base/node2d/parser.ts:52 â€” skew is parsed and stored in Node2DProperties. packages/textscene-core/src/nodes/base/node2d/types.ts:17-20 â€” Node2DLocalTransform interface omits skew entirely. packages/textscene-core/src/r3f/node2dTransform.ts:30 â€” node2dGroupProps() takes Node2DLocalTransform (no skew field) and returns position/rotation/sca
- Fix: Add skew: number to Node2DLocalTransform (types.ts:16-20). In node2dGroupProps (node2dTransform.ts:30), apply a CSS-style 2D shear to the three.js group. three.js groups do not have a direct shear prop, so skew must be encoded as a Matrix4 skew: group.matrix.set(1, Math.tan(t.skew), 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y_negated, z, 1) with matrixAutoUpdate=false, or alternatively, apply the conjugated shear: because under the F=diag(1,-1,1) conjugation a Godot X-shear by tan(ske

### [#35] Node2D.z_as_relative  (LOW / node2d-transform / wrong-mapping) - [ ]
- Godot: Godot 4.x docs: CanvasItem.z_as_relative (bool, default true). When true, effective z = parent_effective_z + z_index. When false, effective z = z_index (absolute, independent of parent). Ref: https://docs.godotengine.org/en/4.4/classes/class_canvasitem.html â€” 'If true, the node's Z index is relative to its parent's Z index.' A node with z_as_relative=false and z_index=5 under
- Ours: packages/textscene-core/src/nodes/base/node2d/parser.ts:54 â€” z_as_relative is correctly parsed. packages/textscene-core/src/nodes/base/node2d/Component.tsx:17 â€” passes props.z_index * Z_INDEX_STEP as the local-frame Z of the three.js group, which always accumulates additively through nested groups regardless of z_as_relative. z_as_relative is stored in Node2DProperties (typ
- Fix: Pass z_as_relative into node2dGroupProps (or resolve it beforehand in Component.tsx). When z_as_relative=false, the z argument should be the node's z_index * Z_INDEX_STEP in world space (absolute), not relative to parent. This requires knowing the parent's accumulated Z, which is not currently tracked. A CanvasItemZContext (analogous to Modulate2DContext) carrying the accumulated absolute Z could be threaded through the tree: each Node2D reads the parent's accumulated absolut

### [#36] CanvasItem.show_behind_parent  (LOW / node2d-transform / missing) - [ ]
- Godot: Godot 4.x docs: CanvasItem.show_behind_parent (bool, default false). When true, the item is drawn behind its parent in the 2D rendering order, visually appearing underneath the parent node. Ref: https://docs.godotengine.org/en/4.4/classes/class_canvasitem.html#class-canvasitem-property-show-behind-parent.
- Ours: Not parsed anywhere in the codebase. Absent from Node2DProperties (packages/textscene-core/src/nodes/base/node2d/types.ts), parser.ts, and Component.tsx. Confirmed by grep returning no matches for 'show_behind_parent' in the entire src tree.
- Fix: Parse show_behind_parent (bool, default false) in parseNode2D (parser.ts) and store it in Node2DProperties. In Component.tsx, when show_behind_parent=true, use a negative Z offset (e.g. -Z_INDEX_STEP * 0.5) so the child sits just behind its parent's origin in the three.js group, approximating the Godot behind-parent draw order.

### [#37] Node3D.top_level  (LOW / node3d-transform / missing) - [ ]
- Godot: When top_level = true, the Node3D ignores all ancestor transforms and its transform/global_transform are identical â€” the node is positioned in world space regardless of parent. Serialized as 'top_level = true' in TSCN when enabled. Godot docs: https://docs.godotengine.org/en/stable/classes/class_node3d.html#class-node3d-property-top-level
- Ours: packages/textscene-core/src/nodes/base/node3d/parser.ts:17 â€” parseNode3D() only reads 'transform' and 'visible'; top_level is never parsed or stored. Component.tsx renders every node as a child <group> inside its parent, so the parent transform is always inherited.
- Fix: Parse top_level in parseNode3D and store in Node3DProperties. In the Node3D Component, when top_level is true, use R3F's <group> with an absolute world-space matrix (via a <group ref> + updateWorldMatrix trick, or by walking the ancestor chain to compute the inverse-parent transform and folding it into the node's position/rotation/scale before passing to <group>).

### [#38] CanvasItem.self_modulate  (LOW / sprite2d-animated / missing) - [ ]
- Godot: CanvasItem.self_modulate (Color, default Color(1,1,1,1)) multiplies the tint onto the node's own rendered pixels only, without propagating to children â€” unlike `modulate` which propagates. Godot docs: 'CanvasItem.self_modulate: Multiplying color. Unlike modulate, this color is not inherited by children CanvasItems.'
- Ours: packages/textscene-core/src/nodes/base/node2d/parser.ts:55 â€” parseNode2D only reads `properties.modulate`; there is no line reading `properties.self_modulate`. The property is silently dropped. packages/textscene-core/src/nodes/base/node2d/types.ts has no `self_modulate` field in Node2DProperties. canvasItemModulate.ts line 7 acknowledges the gap: '(self_modulate, which does 
- Fix: Parse `self_modulate` in parseNode2D (same path as modulate, with the same sRGBâ†’linear conversion once finding #1 is fixed). Add it to Node2DProperties. In the Sprite2D and AnimatedSprite2D Components, multiply self_modulate onto the material color/opacity AFTER the child-propagating modulate context has been set, so the tint applies to own pixels only and is not passed to Modulate2DContext.Provider.

### [#39] SpriteBase3D.double_sided  (LOW / sprite3d / wrong-default) - [ ]
- Godot: SpriteBase3D.double_sided (bool, default true). When false, the sprite is only visible from the front face. Docs: 'If true, texture can be seen from the back as well, if false, it is invisible when looking at it from behind.'
- Ours: packages/textscene-core/src/nodes/3d/sprite3d/Component.tsx:175 â€” `side={THREE.DoubleSide}` is hardcoded regardless of the double_sided property. double_sided is not parsed in parser.ts.
- Fix: Parse double_sided as a bool (default true) in parser.ts and linterParser.ts. In the Component, set `side={properties.double_sided ? THREE.DoubleSide : THREE.FrontSide}`. Note: since the default matches our current hardcode, this only diverges when explicitly set to false.

### [#40] SpriteBase3D.transparent  (LOW / sprite3d / missing) - [ ]
- Godot: SpriteBase3D.transparent (bool, default true). When false, the sprite's texture alpha is ignored and the quad renders fully opaque. Docs: 'If true, the texture's transparency and the opacity are used to make those parts of the sprite invisible.'
- Ours: packages/textscene-core/src/nodes/3d/sprite3d/parser.ts â€” the bool property 'transparent' is not parsed (our 'transparency' float is a separate property). packages/textscene-core/src/nodes/3d/sprite3d/Component.tsx:106 â€” `const transparent = opacity < 1 || properties.alpha_cut !== AlphaCutMode.ALPHA_CUT_DISABLED;` derives the THREE material's transparent flag from opacity/a
- Fix: Parse 'transparent' as a bool (default true) in parser.ts and linterParser.ts. When false, force `transparent=false` on the THREE material and set `alphaTest=0`, effectively disabling alpha blending.

### [#41] StyleBoxFlat.shadow_size / shadow_color / shadow_offset  (LOW / stylebox / missing) - [ ]
- Godot: StyleBoxFlat draws a drop shadow when shadow_size >= 1. shadow_color (default Color(0,0,0,0.6)) sets its color; shadow_offset (default Vector2(0,0)) shifts it. Docs: https://docs.godotengine.org/en/4.4/classes/class_styleboxflat.html â€” 'The shadow size in pixels. This has no effect if shadow_size is lower than 1.'
- Ours: packages/textscene-core/src/r3f/controls/styleBoxToCss.ts â€” no shadow_size / shadow_color / shadow_offset keys are read or mapped. No box-shadow CSS property is ever emitted.
- Fix: Read shadow_size, shadow_color, shadow_offset after the border block. If shadow_size >= 1, emit: style.boxShadow = `${offsetX}px ${offsetY}px ${shadow_size}px ${shadowColorCss}`. Parse shadow_offset as a Vector2 to extract x/y components.

### [#42] StyleBoxFlat.border_color (default fallback)  (LOW / stylebox / wrong-default) - [ ]
- Godot: StyleBoxFlat.border_color default is Color(0.8, 0.8, 0.8, 1) â€” light gray. Docs: https://docs.godotengine.org/en/4.4/classes/class_styleboxflat.html â€” 'Sets the color of the border.' Default: Color(0.8, 0.8, 0.8, 1).
- Ours: packages/textscene-core/src/r3f/controls/styleBoxToCss.ts:54 â€” fallback when data.border_color is absent: `'rgba(0, 0, 0, 1)'` (opaque black). Triggered whenever border_width > 0 but no border_color key is written in the TSCN (because the author left it at the Godot default and Godot omits default-valued properties from .tscn output).
- Fix: Change the fallback on line 54 from 'rgba(0, 0, 0, 1)' to 'rgba(204, 204, 204, 1)' (= Color(0.8,0.8,0.8,1) rounded to 8-bit).

### [#43] StyleBoxFlat.border_blend  (LOW / stylebox / missing) - [ ]
- Godot: When border_blend = true, the border gradually fades from border_color into bg_color rather than having a sharp edge. Default is false. Docs: https://docs.godotengine.org/en/4.4/classes/class_styleboxflat.html â€” 'If true, the border will fade into the background color.'
- Ours: packages/textscene-core/src/r3f/controls/styleBoxToCss.ts â€” border_blend key is never read. CSS has no direct equivalent (would require a gradient border via border-image or background-clip tricks).
- Fix: Approximate with CSS border-image using a radial/linear gradient, or document as a known limitation in PARITY-LIMITATIONS.md. The CSS approximation is complex and border_blend is rarely used.

### [#44] Label.uppercase  (LOW / text-controls / missing) - [ ]
- Godot: Label.uppercase (bool, default false): when true, all text is displayed in UPPERCASE. Godot 4.4 docs: https://docs.godotengine.org/en/4.4/classes/class_label.html (uppercase property). Directly maps to CSS `text-transform: uppercase`.
- Ours: packages/textscene-core/src/nodes/2d/ui/label/types.ts â€” `uppercase` not declared. packages/textscene-core/src/nodes/2d/ui/label/parser.ts â€” `uppercase` not parsed. packages/textscene-core/src/nodes/2d/ui/label/Component.tsx â€” no `text-transform` CSS applied.
- Fix: Add `uppercase?: boolean` to LabelProperties (label/types.ts); parse it in label/parser.ts as `result.uppercase = properties.uppercase === 'true'`; in label/Component.tsx apply `if (props.uppercase) style.textTransform = 'uppercase'`.

### [#45] RichTextLabel.fit_content  (LOW / text-controls / wrong-mapping) - [ ]
- Godot: RichTextLabel.fit_content (bool, default false): when true the control automatically adjusts its height to fit its content. Godot 4.4 docs: https://docs.godotengine.org/en/4.4/classes/class_richtextlabel.html (fit_content property). With fit_content=true the outer box shrinks to content height instead of staying at its anchored/preset height.
- Ours: packages/textscene-core/src/nodes/2d/ui/richtextlabel/parser.ts:14 â€” `result.fitContent = properties.fit_content === 'true'` (parsed). packages/textscene-core/src/nodes/2d/ui/richtextlabel/Component.tsx â€” `fitContent` is never read; no height-shrink CSS is applied. The control always fills its layout-computed height.
- Fix: In RichTextLabel/Component.tsx read `props.fitContent` and when true add `style.height = 'fit-content'` (CSS `height: fit-content` makes the block shrink to its content height). Ensure `overflow: 'visible'` is also set so content is not clipped.

### [#46] TextureRect.stretch_mode = 4 (STRETCH_KEEP_ASPECT)  (LOW / texturerect-colorrect / wrong-mapping) - [ ]
- Godot: STRETCH_KEEP_ASPECT scales the texture to fit the bounding rect while preserving aspect ratio, aligned to the top-left. Godot 4.4 docs: 'Scale the texture to fit the node's bounding rectangle, but maintain the texture's aspect ratio.' Confirmed in texture_rect.cpp: offset remains (0,0) â€” unlike KEEP_ASPECT_CENTERED which adds (size-tex)/2.
- Ours: packages/textscene-core/src/nodes/2d/ui/texturerect/Component.tsx:144-152 â€” default branch returns 'contain'. No objectPosition is set for mode 4 (only modes 3 and 5 get 'center' at line 137). CSS object-fit: contain defaults to object-position: 50% 50% (centered).
- Fix: Add explicit objectPosition: 'top left' for stretchMode === 4 in textureRectFit. The object-fit: contain mapping itself is correct for this mode.
