---
type: CodeEdit
category: 2D
status: unimplemented
fixture: unit-code-edit.tscn
# image: unit-code-edit
renders_as: invisible transform-only fallback
---

# CodeEdit

CodeEdit is the source-code editor Control, a TextEdit with gutters, completion,
indentation and folding. The previewer parses and validates it but does not draw it, so
it renders as a transform-only fallback and its children still show.

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

`linterParser.ts` format-checks all 22 of CodeEdit's own members. `index.ts` registers
`parseControl` unchanged, which reads none of them, so a bad `indent_size` or a
delimiter missing its start key is never read and never substituted.

## Known limitations

- **Not drawn** Godot draws the editor, its gutters and its text. The previewer draws
  nothing for this node.
