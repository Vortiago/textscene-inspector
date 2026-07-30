---
type: RichTextLabel
category: 2D
fixture: unit-rich-text-label.tscn
image: unit-rich-text-label
renders_as: a positioned HTML div of styled text
---

# RichTextLabel

A Control that lays out a run of rich text; the previewer draws it as a
positioned `<div>` and, with `bbcode_enabled`, renders a BBCode subset as inline
styling (ADR-0003). Both images show one line reading "Bold, italic, underline,
and colored BBCode" pinned to the top-left, with each tagged word carrying its
style.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `text` | `"[b]Bold[/b], [i]italic[/i], [u]underline[/u], and [color=#e0a030]colored[/color] BBCode"` | the visible line of text |
| `bbcode_enabled` | `true` | tags render as styling, not literal characters |
| `fit_content` | `true` | box shrinks to the single line's height at the top edge |
| `theme_override_font_sizes/normal_font_size` | `18` | the size of the text |
| `theme_override_colors/default_color` | `Color(0.9, 0.9, 0.9, 1)` | the light-grey of the untagged words |

`[b]` renders bold, `[i]` italic, `[u]` underlined, and `[color=#e0a030]` in the
same orange in both images.

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin RichTextLabel -->
Strict parsing format-checks the inherited set (26 inherited from Control, 15 inherited from CanvasItem); `RichTextLabel` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

`RichTextLabel` has no strict counterpart for `bbcode_enabled` or `fit_content`
either. Both flags use a direct string comparison against `'true'`, so an absent
property or any other value (`"1"`, garbage text) silently resolves to `false`, with
no warning logged.
