/** Control text: Label, RichTextLabel, TextEdit, CodeEdit and LineEdit. */

export const CONTROL_TEXT_SCENES = [
  { name: 'label-wrap', file: 'unit-label-2d-wrap.tscn' },
  // The one variable: `vertical_alignment`. Every other Label is V_TOP, where
  // the offset is zero and Godot's int conversion of it is a no-op, so nothing
  // else draws the CENTER/BOTTOM/FILL branches.
  { name: 'label-valign', file: 'unit-label-2d-valign.tscn' },
  // The one variable: `paragraph_spacing` and `line_spacing`, from `label_settings` and from the
  // theme constants. Godot 4.6.3 `--mode 2d` ink rows at font size 20: 28, 79, 130 (pitch 51) and
  // 28, 49, 70 (pitch 21). Every other Label keeps the default spacing of 3 and 0.
  { name: 'label-paragraph-spacing', file: 'unit-label-paragraph-spacing.tscn' },
  // The one variable: the code point a Label draws in the default font, outside ASCII and Latin-1
  // and from a canonical decomposition.
  { name: 'label-default-font-code-points', file: 'unit-label-2d-default-font-code-points.tscn' },
  // The one variable: `gui/theme/custom_font` in the fixture's own project.godot, which every
  // Control with no theme font then draws, with the RichTextLabel's bold on the same face.
  {
    name: 'label-project-default-font',
    file: 'project-default-font/unit-label-project-default-font.tscn',
  },
  // The one variable: a SystemFont as `gui/theme/custom_font`, which is every default it tries, so
  // it has no face and draws hex-code boxes, under a FontVariation too.
  {
    name: 'label-custom-font-system-font',
    file: 'custom-font-system-font/unit-custom-font-system-font-label.tscn',
  },
  // The one variable: a SystemFont as the project theme's `default_font`, which skips itself and
  // draws `gui/theme/custom_font`.
  { name: 'label-theme-system-font', file: 'theme-system-font/unit-theme-system-font.tscn' },
  // The one variable: a BMFont `.fnt` font at its fixed size, double, one and a half times, tinted, and with a missing glyph.
  { name: 'label-bmfont', file: 'unit-label-bmfont.tscn' },
  // The one variable: a BMFont's outline set, which Godot draws for any `outline_size` above 0.
  { name: 'label-bmfont-outline', file: 'unit-label-bmfont-outline.tscn' },
  // The one variable: `variation_opentype` at `wght` 700 over Cascadia Code, whose `gvar` deltas move the outlines.
  { name: 'label-font-variation-instance', file: 'unit-label-font-variation-instance.tscn' },
  // The one variable: `variation_opentype` at `MONO` 0.5 over Recursive, whose `GPOS` kerning halves at that instance.
  { name: 'label-font-variation-kerning', file: 'unit-label-font-variation-kerning.tscn' },
  // The one variable: `variation_opentype` at `MONO` 1 or `slnt` -15 over Recursive, whose `GSUB` feature variations swap glyphs.
  { name: 'label-font-variation-glyph-swap', file: 'unit-label-font-variation-glyph-swap.tscn' },
  // The one variable: a BMFont's import `scaling_mode`, Integer and Disabled, at sizes off the fixed size.
  { name: 'label-bmfont-scaling', file: 'unit-label-bmfont-scaling.tscn' },
  // The one variable: a character the font lacks, drawn from the first font of its fallback chain
  // that has it, on a raw font's import, a FontVariation, a BMFont's import and a RichTextLabel.
  { name: 'label-font-fallbacks', file: 'unit-label-font-fallbacks.tscn' },
  // The one variable: a precomposed character the font lacks, drawn as its base and the marks the font has,
  // in a Label at 16 px and 32 px and in a RichTextLabel whose fallback holds a character the marks cannot make,
  // and in Labels over fonts with no GPOS script and with a GPOS that has no mark lookup.
  { name: 'label-decomposed-marks', file: 'unit-label-decomposed-marks.tscn' },
  // The one variable: a run that shapes as a whole, with the default font's ligatures, a contextual
  // GSUB swap at a variable-font instance, a base and marks typed as separate characters, and a
  // RichTextLabel whose colour span splits a ligature.
  { name: 'label-shaped-runs', file: 'unit-label-shaped-runs.tscn' },
  // The one variable: `FontVariation.variation_embolden` over a scene font at 0, 1.2 and 2.0, which
  // grows the outline and widens each advance, as the bold of a RichTextLabel does.
  { name: 'label-font-variation-embolden', file: 'unit-label-font-variation-embolden.tscn' },
  // The one variable: the font of each RichTextLabel style. The default theme's bold, italics and bold
  // italics over the default font, a node's own `bold_font` and `italics_font`, and bare variations
  // that draw the default font itself.
  {
    name: 'richtext-label-style-fonts',
    file: 'unit-rich-text-label-style-fonts.tscn',
  },
  // The one variable: a `FontVariation` with no `base_font`, at embolden 0, 1.2 and 0.6, over the
  // bundled default font, which the `0` row leaves unemboldened.
  {
    name: 'label-font-variation-bundled-embolden',
    file: 'unit-label-font-variation-bundled-embolden.tscn',
  },
  // The one variable: a large embolden on a bare variation, which draws on the canvas painter with
  // FreeType's emboldened outline, as every embolden does.
  {
    name: 'label-font-variation-bundled-embolden-high',
    file: 'unit-label-font-variation-bundled-embolden-high.tscn',
  },
  // The one variable: the same bare variations in a project whose `gui/theme/custom_font` is the
  // default font they wrap.
  {
    name: 'label-variation-default-base',
    file: 'project-default-font/unit-label-variation-default-base.tscn',
  },
  // RichTextLabel's supported bbcode subset in one pass: bold by embolden,
  // italic by skew, the underline rule and a colour span. The styled runs keep a
  // sub-pixel vertical residual against Godot, a FreeType light-hinting limit
  // the slice's sheet records. A span-layout change moves them here.
  { name: 'richtext-label-bbcode', file: 'unit-rich-text-label.tscn' },
  // The same outline on rows set LTR and RTL, where the ring and the fill trim alike.
  { name: 'text-outline-set-direction', file: 'unit-text-outline-set-direction.tscn' },
  // A TextureRect and a Button icon fed by an inline GradientTexture2D. The
  // texture drives each node's minimum size as well as its pixels, so the
  // sibling below moves too: these report a layout regression as well.
  {
    name: 'texturerect-gradienttexture',
    file: 'unit-texturerect-gradienttexture.tscn',
  },
  // Three TextureRects fed by inline AtlasTextures from one four-colour sheet.
  // Each rect shrinks to its region, so a wrong region shows as a wrong rect and
  // moves the sibling below. The third cell's `margin` widens the reported box
  // and insets the region inside it.
  {
    name: 'texturerect-atlastexture',
    file: 'unit-texturerect-atlastexture.tscn',
  },
  // The one variable: the texture_filter ancestor walk. Three TextureRects on an
  // 8x8 checkerboard at 25x name no filter. The left two inherit NEAREST, one
  // past a PARENT_NODE parent. The right one keeps the viewport's LINEAR. No
  // other TextureRect scene puts a naming ancestor above an inheriting one.
  {
    name: 'texturerect-filter-inherit',
    file: 'unit-texture-rect-filter-inherit.tscn',
  },
  // A TextureRect at its minimum size takes a ViewportTexture's size only when it holds it directly.
  // Godot 4.6.3 `--mode 2d`: (130,115) rgb(255,0,0), and nothing at (330,115) or (530,115).
  {
    name: 'texture-rect-viewport-texture-wrapped',
    file: 'unit-texture-rect-viewport-texture-wrapped.tscn',
  },
  // A TextureRect samples a ViewportTexture through the Control walker. Godot 4.6.3 `--mode 2d`:
  // (200,150) rgb(255,0,0) and (200,250) rgb(0,0,255), the target's two halves upright.
  {
    name: 'texture-rect-viewport-texture',
    file: 'unit-texture-rect-viewport-texture.tscn',
  },
  // A flipped TextureRect samples its own copy of the target through a mirrored window. Godot
  // 4.6.3 `--mode 2d`: (150,150) rgb(0,0,255) and (290,150) rgb(0,255,0).
  {
    name: 'texture-rect-viewport-texture-flip',
    file: 'unit-texture-rect-viewport-texture-flip.tscn',
  },
  // The one variable: a Label that autowraps inside a container that sizes to
  // it. `label-wrap` sets authored widths with no parent to be wrong against.
  // Here the card's own height is the measurement.
  {
    name: 'label-autowrap-in-container',
    file: 'unit-label-autowrap-in-container.tscn',
  },
  // The one variable: a theme outline, a stroked ring on the canvas painter behind the fill.
  // Other text scenes draw the fill alone. `label-stacked-effects` adds the stacked arrays.
  { name: 'label-outline', file: 'unit-label-outline.tscn' },
  { name: 'label-stacked-effects', file: 'unit-label-stacked-effects.tscn' },
  // The one variable: a large glyph's curved edges, filled and ringed apart, as FreeType's chords draw them.
  { name: 'label-glyph-edges', file: 'unit-label-glyph-edges.tscn' },
  // The one variable: a `label_settings` loaded from its own `.tres` file, which beats the
  // node-local theme overrides as an inline one does.
  { name: 'label-label-settings-tres', file: 'unit-label-label-settings-tres.tscn' },
  // The one variable: `label_settings.font`. Godot 4.6.3 `--mode 2d`: the settings-font Label
  // inks x 22-430, rows 26-67.
  { name: 'label-settings-font', file: 'unit-label-settings-font.tscn' },
  // The one variable: a control character reaching the shaper. Elsewhere it
  // advances zero, so only a field that opts into the hex box shows whether its
  // geometry and its advance agree. Godot 4.6.3 `--mode 2d`: mean 0.037 of 255.
  {
    name: 'lineedit-control-chars',
    file: 'unit-lineedit-control-chars.tscn',
  },
  // The one variable: the theme text outline of LineEdit, at outline_size 4, 8 and 16.
  { name: 'lineedit-outline', file: 'unit-lineedit-outline.tscn' },
  // The text family places runs on the resolved layout direction. Two pin an
  // absence: a Latin paragraph infers LTR at `text_direction`'s AUTO default, so
  // Godot mirrors neither a FILL label nor a RichTextLabel line, whose arms read
  // the paragraph direction.
  { name: 'label-rtl-alignment', file: 'unit-label-rtl-alignment.tscn' },
  { name: 'label-rtl-fill-autowrap', file: 'unit-label-rtl-fill-autowrap.tscn' },
  { name: 'label-rtl-visible-chars-auto', file: 'unit-label-rtl-visible-chars-auto.tscn' },
  { name: 'label-visible-characters-astral', file: 'unit-label-visible-characters-astral.tscn' },
  // A Label's own paragraph direction: the bidirectional reorder, the arms that read the inferred
  // direction, the structured override and the language.
  { name: 'label-bidi', file: 'unit-label-bidi.tscn' },
  { name: 'label-bidi-alignment', file: 'unit-label-bidi-alignment.tscn' },
  { name: 'label-structured-text', file: 'unit-label-structured-text.tscn' },
  { name: 'label-language', file: 'unit-label-language.tscn' },
  { name: 'label-astral-rtl', file: 'unit-label-astral-rtl.tscn' },
  { name: 'line-edit-rtl', file: 'unit-line-edit-rtl.tscn' },
  { name: 'text-edit-rtl', file: 'unit-text-edit-rtl.tscn' },
  { name: 'text-edit-placeholder', file: 'unit-text-edit-placeholder.tscn' },
  { name: 'text-edit-overflow', file: 'unit-text-edit-overflow.tscn' },
  { name: 'text-edit-scroll-bars', file: 'unit-text-edit-scroll-bars.tscn' },
  { name: 'text-edit-minimap', file: 'unit-text-edit-minimap.tscn' },
  { name: 'code-edit-readonly-highlighter', file: 'unit-code-edit-readonly-highlighter.tscn' },
  { name: 'code-edit-empty-gutter', file: 'unit-code-edit-empty-gutter.tscn' },
  { name: 'code-edit-rtl', file: 'unit-code-edit-rtl.tscn' },
  { name: 'rich-text-label-rtl', file: 'unit-rich-text-label-rtl.tscn' },
  { name: 'line-edit-text-direction', file: 'unit-line-edit-text-direction.tscn' },
  { name: 'text-edit-text-direction', file: 'unit-text-edit-text-direction.tscn' },
  { name: 'rich-text-label-text-direction', file: 'unit-rich-text-label-text-direction.tscn' },
  // A TextureProgressBar part-filled, so it crops its progress texture. The crop samples the
  // undecoded bytes as the other layers do, and a second sRGB decode would darken it.
  { name: 'texture-progress-bar-partial', file: 'unit-texture-progress-bar-partial.tscn' },
  // Two LTR alignment scenes. The fractional-box one needs a non-integer box
  // width: at a whole width the ceiled and raw line extents give one offset.
  { name: 'rich-text-label-center-overflow', file: 'unit-rich-text-label-center-overflow.tscn' },
  { name: 'rich-text-label-fractional-box', file: 'unit-rich-text-label-fractional-box.tscn' },
  { name: 'rich-text-label-fill', file: 'unit-rich-text-label-fill.tscn' },
  { name: 'rich-text-label-clip', file: 'unit-rich-text-label-clip.tscn' },
  { name: 'rich-text-label-scrollbar', file: 'unit-rich-text-label-scrollbar.tscn' },
  { name: 'rich-text-label-scrollbar-rtl', file: 'unit-rich-text-label-scrollbar-rtl.tscn' },
  { name: 'rich-text-label-scrollbar-following', file: 'unit-rich-text-label-scrollbar-following.tscn' },
  { name: 'rich-text-label-visible-characters', file: 'unit-rich-text-label-visible-characters.tscn' },
  {
    name: 'rich-text-label-visible-characters-follow',
    file: 'unit-rich-text-label-visible-characters-follow.tscn',
  },
  { name: 'rich-text-label-hr', file: 'unit-rich-text-label-hr.tscn' },
  { name: 'rich-text-label-font-size-outline', file: 'unit-rich-text-label-font-size-outline.tscn' },
  { name: 'rich-text-label-paragraph-justification', file: 'unit-rich-text-label-paragraph-justification.tscn' },
  { name: 'rich-text-label-paragraph-tab-stops', file: 'unit-rich-text-label-paragraph-tab-stops.tscn' },
  { name: 'rich-text-label-empty-styling-before-paragraph', file: 'unit-rich-text-label-empty-styling-before-paragraph.tscn' },
  { name: 'rich-text-label-empty-line-vertical-fill', file: 'unit-rich-text-label-empty-line-vertical-fill.tscn' },
  { name: 'rich-text-label-lists', file: 'unit-rich-text-label-lists.tscn' },
  { name: 'rich-text-label-numeral-system', file: 'unit-rich-text-label-numeral-system.tscn' },
  { name: 'label-fill-paragraphs', file: 'unit-label-fill-paragraphs.tscn' },
  { name: 'label-tab-without-stop', file: 'unit-label-tab-without-stop.tscn' },
  { name: 'label-fill-trim', file: 'unit-label-fill-trim.tscn' },
  // The caret an `editable = false` field still draws.
  { name: 'text-edit-caret-readonly', file: 'unit-text-edit-caret-readonly.tscn' },
  // A wrapped row's step-in.
  { name: 'text-edit-indent-wrapped', file: 'unit-text-edit-indent-wrapped.tscn' },
  // The column rules.
  { name: 'code-edit-guidelines', file: 'unit-code-edit-guidelines.tscn' },
  // The fold arrow the delimiter tables decide.
  { name: 'code-edit-delimiters', file: 'unit-code-edit-delimiters.tscn' },
  // The one variable: a Theme `normal` box on Label. It draws under the text, adds its minimum, narrows the wrap width and
  // offsets left and right lines, not centred ones (Godot 4.6.3 `--mode 2d`: max 1 of 255, 1 px).
  { name: 'label-theme-normal-box', file: 'unit-label-theme-normal-box.tscn', mode: '2d' },
  // The one variable: the default theme's Label variations. Header sizes, the graph and tooltip title colours,
  // the frame title size and the TooltipPanel box (Godot 4.6.3 `--mode 2d`: max 1 of 255, 16 px).
  { name: 'label-default-theme-variations', file: 'unit-label-default-theme-variations.tscn', mode: '2d' },
];
