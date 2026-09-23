# The float grammar

`number.ts` transcribes the number grammar of Godot's own tokenizer
(`variant_parser.cpp`). This file records each clause with its source line and
the result measured on 4.6.3.

## `FLOAT_PATTERN_SOURCE`: one finite float component

The pattern is `-?\d+(?:\.\d*)?(?:[eE][-+]?\d*)?`, from `get_token`
(`variant_parser.cpp:420-481`). It is anchored, so `1.2.3` or a lone `-` fails,
and the caller throws or warns and falls back.

| Clause | Source | Measured |
| --- | --- | --- |
| `-?` | `-` is consumed at :420. `+` is not, because a digit must follow (:424). | `+3` fails the load with `Unexpected character` (:506). |
| `\d+` | Required: `.` starts neither a digit nor an identifier. | `.5` fails the load. `5.` loads as 5. |
| `(?:\.\d*)?` | `READING_INT` takes one `.` into `READING_DEC` (:442), with zero or more digits. | |
| `(?:[eE][-+]?\d*)?` | `READING_EXP` (:466-472) takes one sign and zero or more digits, and `as_double` reads the token. | `1e`, `1e-` and `5.e2` load as 1, 1 and 500, as `parseFloat` reads them. |

The mantissa is `\d+(?:\.\d*)?`, not `\d+\.?\d*`. The second form splits a digit
run in O(n) ways, so a long run with a non-matching tail in untrusted input
backtracks quadratically (ReDoS).

The pattern is finite by choice, and narrower than Godot. It refuses `inf`,
`-inf`, `inf_neg` and `nan`, so a decoder falls back to its default (`allFinite`
in `number.ts` says why). `parseVector2` and `parseOptionalRect2` also test the
result of `matchedFloat`. The linter uses `TSCN_FLOAT_PATTERN_SOURCE`.

## `TSCN_FLOAT_PATTERN_SOURCE`: one float component as the linter reads it

The pattern is the finite grammar plus the four non-finite spellings of
`NON_FINITE_FLOATS`. `_parse_construct` (`variant_parser.cpp:552-596`) accepts a
number or a `stor_fix` identifier. The writer puts every real component through
`rtos_fix`:

| Type | Line |
| --- | --- |
| `Vector2` | :2040 |
| `Rect2` | :2048 |
| `Vector3` | :2056 |
| `Vector4` | :2064 |
| `Plane` | :2072 |
| `AABB` | :2076 |
| `Quaternion` | :2080 |
| `Transform2D` | :2090 |
| `Basis` | :2104 |
| `Transform3D` | :2119 |
| `Projection` | :2135 |
| `Color` | :2145 |
| Packed arrays | :2459-2549 |

An `i` composite uses `itos` and has no non-finite spelling.

The split matches `floatOr` (`parser/valueParsers.ts`) versus `v.float` for
scalars: Godot refuses none of these spellings, so the linter reports none.

The alternation comes from the keys of `NON_FINITE_FLOATS`, so it reads exactly
what `parseGodotFloat` reads:

- The longest key comes first, because the alternation is leftmost-first and
  `inf` would shadow `inf_neg`.
- The keys hold no regex metacharacter.
- The fixed-length alternatives cannot start where the numeric branch starts,
  so the match stays linear.
- The pattern has no capture group: callers wrap it in `(…)` and read
  `match[1..arity]`.
