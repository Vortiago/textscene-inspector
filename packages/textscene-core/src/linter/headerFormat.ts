/**
 * The `format=` version in a `.tscn`/`.tres` header, and where it sits.
 *
 * The engine draws its line only at the TOP: `if (format_version >
 * FORMAT_VERSION)` refuses a file as `ERR_FILE_UNRECOGNIZED`
 * (`resource_format_text.cpp:1141-1146`, byte-identical at `:1331` and `:1369`),
 * and there is no less-than comparison anywhere in that file — an older format
 * is parsed with the current grammar, unconverted. So a low ceiling is a
 * statement about THIS linter's scope, not a report of engine behaviour, and
 * the diagnostic built on it says so.
 */

import { parseHeading } from '../parser/utils.js';
import { parseGodotFloat } from '../godot/number.js';

/**
 * The newest format this linter does not lint.
 *
 * Version 3 is where the grammar these rules are written against begins:
 * "Version 3: New string ID for ext/subresources, breaks forward compat."
 * (`resource_format_text.h:44`). A `format=2` file spells every
 * `ExtResource`/`SubResource` id as an integer, so the reference rules would
 * report a file that loads perfectly as a mass of dangling references.
 *
 * The current end is deliberately NOT bounded here. Godot 4.6.3 writes 3 and 4
 * from one saver — `FORMAT_VERSION = 4` is the accepted ceiling
 * (`resource_format_text.h:46`), `FORMAT_VERSION_COMPAT = 3` is the default
 * (`:48`), and `_find_resources` picks between them per file on whether a
 * PackedVector4Array or a >64-byte PackedByteArray is present
 * (`resource_format_text.cpp:1724-1732`, `:1770`, `:1798`). Neither is legacy.
 */
export const LEGACY_FORMAT_CEILING = 2;

/** A header's declared format version, or `null` where it declares none. */
export interface HeaderFormat {
  /**
   * The version, or `null` when the attribute is absent or unreadable.
   *
   * Absent is CURRENT, not legacy: `} else { format_version = FORMAT_VERSION; }`
   * (`resource_format_text.cpp:1147-1148`).
   */
  readonly format: number | null;
  /** 1-based line the header sits on. */
  readonly line: number;
}

/**
 * The file's own `[gd_scene …]`/`[gd_resource …]` header, or `null` for content
 * that opens with neither.
 *
 * Finds the first line that is neither blank nor a `;` comment, and reads ONLY
 * that one. Two reasons it cannot just take line 1: 40 scenes under `scenes/`
 * open with a comment block and carry the header below it; and a header the
 * heading grammar cannot read must stop the search rather than advance, or an
 * unclosed `[gd_scene format=3` would hand the next `[ext_resource …]` line to
 * a caller asking about the file.
 *
 * The field is read as Godot reads it: a Variant number assigned to an `int`.
 * `format_version = tag.fields["format"]` (`resource_format_text.cpp:1140`)
 * targets `int format_version` (`resource_format_text.h:68`), so a fractional
 * or exponent spelling TRUNCATES rather than failing to parse —
 * `[gd_scene format=2.0]` IS a format-2 file and must get the legacy scope
 * limit. Reading only `\d+` called it unreadable, which returns `null`, which
 * is the ABSENT-format case (`:1147-1148`, defaulting to the CURRENT version)
 * — so a legacy file was linted against a grammar it predates.
 *
 * `parseGodotFloat` is the shared Variant reader rather than a rebuilt one, and
 * the read is not `Number(raw)`: `Number` takes `format=` as 0 and would call
 * an empty attribute the oldest format there is, and it takes the
 * bare-exponent spellings Godot's `READING_EXP` admits — `2e` and `1e-`, which
 * load as 2 and 1 — as NaN, which is the ABSENT case and defaults to the
 * CURRENT version. So `[gd_scene format=2e]` was linted against a grammar it
 * predates.
 */
export function readHeaderFormat(content: string): HeaderFormat | null {
  // Walked with `indexOf` rather than `split('\n')`: the answer is always on the
  // first non-blank line, so the walk is O(header) over a file of any size. It
  // saves no allocation at the lint level — `TscnParserCore.parse` splits the
  // same content on the next statement (`Linter.lint`) — only this second copy.
  let at = 0;
  for (let line = 1; at < content.length; line++) {
    const newline = content.indexOf('\n', at);
    const end = newline === -1 ? content.length : newline;
    const trimmed = content.slice(at, end).trim();
    at = end + 1;
    if (trimmed === '' || trimmed.startsWith(';')) continue;

    const heading = parseHeading(trimmed);
    if (!heading || (heading.type !== 'gd_scene' && heading.type !== 'gd_resource')) return null;

    const raw = heading.attributes.format;
    // Unreadable text falls through to a normal lint, matching the parser's own
    // leniency. `1e999` parses and overflows, so the finite check is on the
    // RESULT — a grammar cannot catch it. See the note above `readHeaderFormat`.
    // The shared reader applies the anchored grammar itself and answers `null`
    // for text Godot's tokenizer cannot read, including the empty attribute.
    // `inf`/`nan` are grammatical and come back non-finite, which the check
    // below folds into the same `null`.
    const parsed = raw === undefined ? null : parseGodotFloat(raw);
    const format = parsed !== null && Number.isFinite(parsed) ? Math.trunc(parsed) : null;
    return { format, line };
  }
  return null;
}
