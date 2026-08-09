---
type: CodeEdit
category: 2D
status: unimplemented
fixture: unit-code-edit.tscn
# image: unit-code-edit
renders_as: invisible transform-only fallback
---

# CodeEdit

CodeEdit is Godot's source-code editor Control — a `TextEdit` specialised with gutters,
code completion, indentation and line folding; the previewer parses and validates it but
does not draw it yet, so it renders as an invisible transform-only fallback and its
children still show.

## Properties exercised

| Group | Properties (fixture values) | Effect |
| --- | --- | --- |
| Ungrouped | `symbol_lookup_on_click`, `symbol_tooltip_on_hover`, `line_folding`, `line_length_guidelines` (`PackedInt32Array(80, 120)`) | Format-checked only; the previewer draws nothing regardless. |
| Gutters | `gutters_draw_breakpoints_gutter`, `gutters_draw_bookmarks`, `gutters_draw_executing_lines`, `gutters_draw_line_numbers`, `gutters_zero_pad_line_numbers`, `gutters_line_numbers_min_digits` (`3`), `gutters_draw_fold_gutter` | Format-checked only. |
| Delimiters | `delimiter_strings` (`PackedStringArray("' '", "\" \"")`), `delimiter_comments` (`PackedStringArray("# ")`) | Format-checked only. |
| Code Completion | `code_completion_enabled`, `code_completion_prefixes` (`PackedStringArray(".", "$")`) | Format-checked only. |
| Indentation | `indent_size` (`4`), `indent_use_spaces`, `indent_automatic`, `indent_automatic_prefixes` (`PackedStringArray(":", "{", "[", "(")`) | Format-checked only. |
| Auto Brace Completion | `auto_brace_completion_enabled`, `auto_brace_completion_highlight_matching`, `auto_brace_completion_pairs` (`{ "\"": "\"", "'": "'", "(": ")", "[": "]", "{": "}" }`) | Format-checked only. |

## Divergences

Not captured yet.

## Linting

<!-- lint:begin CodeEdit -->
Strict parsing format-checks these `CodeEdit` properties, plus 47 inherited from TextEdit, 28 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `auto_brace_completion_enabled` | true or false |
| `auto_brace_completion_highlight_matching` | true or false |
| `auto_brace_completion_pairs` | Dictionary { "open": "close", … }, each key a symbol-only string |
| `code_completion_enabled` | true or false |
| `code_completion_prefixes` | string array (Array[String]([…]), PackedStringArray(…) or […]), each a single character |
| `delimiter_comments` | string array (Array[String]([…]), PackedStringArray(…) or […]), each a symbol-only "start[ end]" delimiter key |
| `delimiter_strings` | string array (Array[String]([…]), PackedStringArray(…) or […]), each a symbol-only "start[ end]" delimiter key |
| `gutters_draw_bookmarks` | true or false |
| `gutters_draw_breakpoints_gutter` | true or false |
| `gutters_draw_executing_lines` | true or false |
| `gutters_draw_fold_gutter` | true or false |
| `gutters_draw_line_numbers` | true or false |
| `gutters_line_numbers_min_digits` | integer 1-5 |
| `gutters_zero_pad_line_numbers` | true or false |
| `indent_automatic` | true or false |
| `indent_automatic_prefixes` | string array (Array[String]([…]), PackedStringArray(…) or […]), each a single character |
| `indent_size` | integer >= 1 |
| `indent_use_spaces` | true or false |
| `line_folding` | true or false |
| `line_length_guidelines` | int array (PackedInt32Array(…), Array[int]([…]) or […]) |
| `symbol_lookup_on_click` | true or false |
| `symbol_tooltip_on_hover` | true or false |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-codeedit-properties` (type-family match) | `codeedit-delimiter-start-key-collision` | error |
<!-- lint:end -->

`linterParser.ts` format-checks all 22 of CodeEdit's own members (everything in
`doc/classes/CodeEdit.xml` except `layout_direction` and `text_direction`, both
default-value overrides). None of this reaches the lenient parser: `parser.ts` reuses
`parseControl` unchanged and never reads a single CodeEdit-specific key, so a bad
`indent_size`, a delimiter missing its symbol-only start key, or an
`auto_brace_completion_pairs` entry with an empty close key all parse and render
identically to a well-formed one — the lenient path has no code path that looks at any
of these values at all, let alone one that could substitute a fallback for a bad one.
