---
type: CodeEdit
category: 2D
status: unreviewed
fixture: unit-code-edit.tscn
# image: unit-code-edit
renders_as: a TextEdit with a line-number gutter
---

# CodeEdit

CodeEdit is the source-code editor Control, a TextEdit with gutters, completion,
indentation and folding. The previewer draws everything TextEdit's painter draws,
shifted right by this node's gutter band, plus the line-numbers gutter, the fold
gutter's arrows and the `line_length_guidelines` rules.

## Linting

<!-- lint:begin CodeEdit -->
Strict parsing format-checks these `CodeEdit` properties, plus 47 inherited from TextEdit, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `auto_brace_completion_enabled` | true or false |  |
| `auto_brace_completion_highlight_matching` | true or false |  |
| `auto_brace_completion_pairs` | Dictionary { "open": "close", … }, each key a symbol-only string |  |
| `code_completion_enabled` | true or false |  |
| `code_completion_prefixes` | string array (Array[String]([…]), PackedStringArray(…) or […]), each a single character |  |
| `delimiter_comments` | string array (Array[String]([…]), PackedStringArray(…) or […]), each a symbol-only "start[ end]" delimiter key |  |
| `delimiter_strings` | string array (Array[String]([…]), PackedStringArray(…) or […]), each a symbol-only "start[ end]" delimiter key |  |
| `gutters_draw_bookmarks` | true or false |  |
| `gutters_draw_breakpoints_gutter` | true or false |  |
| `gutters_draw_executing_lines` | true or false |  |
| `gutters_draw_fold_gutter` | true or false |  |
| `gutters_draw_line_numbers` | true or false |  |
| `gutters_line_numbers_min_digits` | integer 1-5 | warning |
| `gutters_zero_pad_line_numbers` | true or false |  |
| `indent_automatic` | true or false |  |
| `indent_automatic_prefixes` | string array (Array[String]([…]), PackedStringArray(…) or […]), each a single character |  |
| `indent_size` | integer >= 1 | error below |
| `indent_use_spaces` | true or false |  |
| `line_folding` | true or false |  |
| `line_length_guidelines` | int array (PackedInt32Array(…), Array[int]([…]) or […]) |  |
| `symbol_lookup_on_click` | true or false |  |
| `symbol_tooltip_on_hover` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-codeedit-properties` (type-family match) | `codeedit-delimiter-start-key-collision` | error |
<!-- lint:end -->

`linterParser.ts` format-checks every one of CodeEdit's own members. The registered
lenient parser reads the gutter, fold and indent members that the render path uses:
`gutters_draw_line_numbers`, `gutters_zero_pad_line_numbers`,
`gutters_line_numbers_min_digits`, `gutters_draw_bookmarks`,
`gutters_draw_breakpoints_gutter`, `gutters_draw_executing_lines`,
`gutters_draw_fold_gutter`, `line_folding` and `indent_size`. It also reads every property
TextEdit's parser reads.

A malformed boolean reads as `false`, and a malformed integer reads as unset.
`line_folding` is parsed but does not change what this slice draws: its doc in
`types.ts` gives the reason. `indent_size` widens every tab stop (see the doc of
`indentSize`). The strict linter format-checks the delimiter, completion and brace-pair
members, and this parser never reads them, because none of them changes the picture.

## Known limitations

- **Not drawn** The main gutter (bookmark, breakpoint and executing-line icons) reserves
  its column width but draws no icons. Each icon is keyed to per-line state
  (`set_line_as_bookmarked`, `set_line_as_breakpoint`, `set_line_as_executing`). These
  are bound methods with no `ADD_PROPERTY` (`code_edit.cpp:1419-1503`), so a `.tscn`
  cannot serialise any of it. An empty gutter of the right width is all a scene file
  can show.
- **Not drawn** The fold gutter's `folded`/`folded_code_region` icons. Nothing in a
  `.tscn` folds a line, so only the `can_fold`/`can_fold_code_region` pair is reachable
  (`code_edit.cpp:1619-1650`).
- **Not drawn** The completion popup's RTL arms (code_edit.cpp:75,236) and the
  fold-icon hit test's (:426,451,471): a popup needs `code_completion_active`, the
  hit test pointer state.
