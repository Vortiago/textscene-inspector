/**
 * The `format=` version in a `.tscn`/`.tres` header, and where it sits. The engine
 * refuses only a format above `FORMAT_VERSION` (`resource_format_text.cpp:1141-1146`,
 * byte-identical at `:1331` and `:1369`) and parses an older one with the current
 * grammar, so a low ceiling states this linter's scope, not engine behaviour.
 */

import { parseHeading } from '../parser/utils.js';
import { parseGodotFloat } from '../godot/number.js';

/**
 * The newest format this linter does not lint. Version 3 introduced string ids:
 * "Version 3: New string ID for ext/subresources, breaks forward compat."
 * (`resource_format_text.h:44`). A `format=2` file's integer ids would read as a
 * mass of dangling references in a file that loads perfectly.
 */
export const LEGACY_FORMAT_CEILING = 2;

/**
 * Whether a declared format is one this linter declines: `1..LEGACY_FORMAT_CEILING`.
 * The engine's only comparison is `if (format_version > FORMAT_VERSION)`
 * (`resource_format_text.cpp:1141`), so `format=0` and `format=-1` load and lint under
 * the current grammar. `null` is the absent attribute, which defaults to current (:1147).
 */
export function isLegacyFormat(format: number | null): boolean {
  // No upper bound: 4.6.3 writes 3 and 4 from one saver. `FORMAT_VERSION = 4` is the
  // ceiling (`resource_format_text.h:46`), `FORMAT_VERSION_COMPAT = 3` the default
  // (`:48`), and `_find_resources` picks per file on a PackedVector4Array or a >64-byte
  // PackedByteArray (`resource_format_text.cpp:1724-1732`, `:1770`, `:1798`).
  return format !== null && format >= 1 && format <= LEGACY_FORMAT_CEILING;
}

/** A header's declared format version, or `null` where it declares none. */
export interface HeaderFormat {
  /**
   * The version, or `null` when the attribute is absent or unreadable. Absent is
   * current, not legacy: `} else { format_version = FORMAT_VERSION; }`
   * (`resource_format_text.cpp:1147-1148`).
   */
  readonly format: number | null;
  /** 1-based line the header sits on. */
  readonly line: number;
}

/**
 * The file's own `[gd_scene …]`/`[gd_resource …]` header, or `null` for content
 * that opens with neither. It reads only the first line that is neither blank nor
 * a `;` comment, since a scene may open with a comment block. An unreadable header
 * stops the search, so an unclosed `[gd_scene format=3` never hands on the next line.
 */
export function readHeaderFormat(content: string): HeaderFormat | null {
  // `indexOf`, not `split('\n')`: the walk is O(header) over a file of any size. It
  // saves only this second copy, since `TscnParserCore.parse` splits the content anyway.
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
    // Unreadable text, the empty attribute included, is `null` and lints as normal,
    // like the parser. `parseGodotFloat`, not `Number`: `Number` reads `format=` as 0,
    // and reads the `READING_EXP` spellings `2e` and `1e-`, which Godot loads as 2 and
    // 1, as NaN, the absent case that defaults to the current version.
    const parsed = raw === undefined ? null : parseGodotFloat(raw);
    // `format_version = tag.fields["format"]` (`resource_format_text.cpp:1140`) is an
    // `int` (`resource_format_text.h:68`), so `format=2.0` truncates to format 2.
    // `1e999`, `inf` and `nan` read as non-finite, and this check folds them to `null`.
    const format = parsed !== null && Number.isFinite(parsed) ? Math.trunc(parsed) : null;
    return { format, line };
  }
  return null;
}
