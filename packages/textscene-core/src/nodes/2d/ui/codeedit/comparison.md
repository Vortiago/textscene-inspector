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
indentation and folding. The previewer draws everything TextEdit's own painter draws,
shifted right by this node's own gutter band, plus the line-numbers gutter — the one
gutter of the three (main, line numbers, fold) whose content a `.tscn` can determine.

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

`linterParser.ts` format-checks all 22 of CodeEdit's own members. The registered lenient
parser reads 9 — the gutter/fold/indent members the render path touches:
`gutters_draw_line_numbers`, `gutters_zero_pad_line_numbers`,
`gutters_line_numbers_min_digits`, `gutters_draw_bookmarks`,
`gutters_draw_breakpoints_gutter`, `gutters_draw_executing_lines`,
`gutters_draw_fold_gutter`, `line_folding`, `indent_size` — plus every property
TextEdit's own parser already reads. A malformed boolean reads as `false`; a
malformed integer reads as unset. `line_folding` is parsed but inert to what
this slice draws — its own doc in `types.ts` has why; `indent_size` widens
every tab stop (`indentSize`'s own doc). Delimiters, completion and brace-pair
members are format-checked by the strict linter but never read here: none of
them changes this previewer's picture.

## Known limitations

- **Not drawn** The main gutter (bookmark/breakpoint/executing-line icons) and the
  fold gutter (fold arrows) both reserve their own column width but draw no
  icons: every icon is keyed to per-line state (`set_line_as_bookmarked`,
  `set_line_as_breakpoint`, `set_line_as_executing`, `can_fold_line`'s
  delimiter/comment analysis) — all bound methods, never `ADD_PROPERTY`'d
  (`code_edit.cpp:1419-1503`) — so a `.tscn` cannot serialise any of it. An
  empty gutter of the right width is the whole truth of a scene file here.
- **Not drawn** `_draw_guidelines`' RTL mirror (code_edit.cpp:295-312):
  `line_length_guidelines` are not drawn at all. The line-number gutter's two RTL
  shifts — the CUSTOM region mirroring about the control (text_edit.cpp:1471-1476)
  and the number right-aligning inside it (code_edit.cpp:1583-1587) — draw.
- **Not drawn** The completion popup's RTL arms (code_edit.cpp:75,236) and the
  fold-icon hit test's (:426,451,471): a popup needs `code_completion_active`, the
  hit test pointer state.
