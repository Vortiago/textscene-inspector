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
 */
export function readHeaderFormat(content: string): HeaderFormat | null {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    if (trimmed === '' || trimmed.startsWith(';')) continue;

    const heading = parseHeading(trimmed);
    if (!heading || (heading.type !== 'gd_scene' && heading.type !== 'gd_resource')) return null;

    const raw = heading.attributes.format;
    // `/^\d+$/` rather than `Number(raw)`, which reads `format=` as 0 and would
    // declare an empty attribute the oldest format there is. Unreadable text
    // falls through to a normal lint, matching the parser's own leniency.
    const format = raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : null;
    return { format, line: i + 1 };
  }
  return null;
}
