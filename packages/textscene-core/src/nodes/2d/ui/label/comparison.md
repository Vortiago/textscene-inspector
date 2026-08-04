---
type: Label
category: 2D
fixture: unit-label-2d.tscn
image: unit-label-2d
renders_as: a positioned HTML div in the Control overlay
---

# Label

The 2D UI text node. The previewer draws each label as a positioned `<div>` in the
Control overlay, styled from its alignment, case, and wrap settings. The fixture
stacks three labels to exercise those in turn.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `text` | three strings | the text each of the three labels shows |
| `offset_left/top/right/bottom` | e.g. `20/20/260/60` | stacks the labels and fixes each box at 240px wide |
| `horizontal_alignment` | `1` (Center) | "Centered label" sits centered within its box |
| `vertical_alignment` | `1` (Center) | that same label's text is centered vertically in its box |
| `uppercase` | `true` | "shouts when rendered" renders as SHOUTS WHEN RENDERED |
| `autowrap_mode` | `3` (WORD_SMART) | the long string wraps onto three lines |

## Divergences

The auto-wrap paragraph breaks at a different word. Godot lays it out as "This label
wraps across / multiple lines once it runs out / of horizontal space."; ours packs one
more word onto each line — "This label wraps across multiple / lines once it runs out
of / horizontal space." — and spaces those lines slightly tighter. Both reach three
lines, and the centered and single-line labels occupy the same span in both images, so
the box width is not wrong: the previewer draws the text in a system font stack (web
fonts are CSP-blocked in the VS Code webview), so the browser's glyph advances and
leading stand in for Godot's bundled theme font and nudge the break to a different word.

## Linting

<!-- lint:begin Label -->
Strict parsing format-checks the inherited set (27 inherited from Control, 15 inherited from CanvasItem, 10 inherited from Node); `Label` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

Label's own properties, `text`, `horizontal_alignment`, `vertical_alignment`,
`autowrap_mode`, `uppercase`, carry no strict validator either; only the inherited
Control set is checked. `horizontal_alignment`, `vertical_alignment`, and
`autowrap_mode` use `parseOptionalInt`, so an absent or unparseable value becomes
`undefined` silently, no warning. `uppercase` isn't `boolOr`: only the literal
string `"true"` turns it on, anything else (including a garbled value) leaves it
falsy without a warning.
