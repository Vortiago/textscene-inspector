/**
 * The `format=` version in a `.tscn`/`.tres` header, and where it sits. The engine
 * refuses only a format above `FORMAT_VERSION` (`resource_format_text.cpp:1141-1146`,
 * byte-identical at `:1331` and `:1369`) and parses an older one with the current
 * grammar, so a low ceiling states this linter's scope, not engine behaviour.
 */

import { parseGodotFloat } from '../godot/variant/number.js';
import { strToVar } from '../godot/variant/strToVar.js';
import { HEADER_READING, readTag } from '../godot/variant/tagReader.js';
import { VARIANT_TYPE } from '../godot/variant/variantType.js';

/**
 * The newest format this linter does not lint. Version 3 introduced string ids:
 * "Version 3: New string ID for ext/subresources, breaks forward compat."
 * (`resource_format_text.h:44`). A `format=2` file's integer ids would read as a
 * mass of dangling references in a file that loads perfectly.
 */
const LEGACY_FORMAT_CEILING = 2;

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
interface HeaderFormat {
  /**
   * The version, or `null` when the attribute is absent or unreadable. Absent is
   * current, not legacy: `} else { format_version = FORMAT_VERSION; }`
   * (`resource_format_text.cpp:1147-1148`).
   */
  readonly format: number | null;
  /** 1-based line the header sits on. */
  readonly line: number;
  /** 1-based column of the header's `[`. */
  readonly column: number;
}

/** The `[gd_scene …]` or `[gd_resource …]` tag after any blank or `;` lines, or null where it is neither. */
export function readHeaderFormat(content: string): HeaderFormat | null {
  // `indexOf`, not `split('\n')`: the walk is O(header) over a file of any size. It
  // saves only this second copy, since `TscnParserCore.parse` splits the content anyway.
  let at = 0;
  for (let line = 1; at < content.length; line++) {
    const newline = content.indexOf('\n', at);
    const end = newline === -1 ? content.length : newline;
    const lineStart = at;
    const written = content.slice(at, end);
    const trimmed = written.trim();
    at = end + 1;
    if (trimmed === '' || trimmed.startsWith(';')) continue;

    // The tag reader, not the line: a header may carry a comment, run over lines or have text after its `]`.
    const heading = readTag(content, lineStart, line, HEADER_READING);
    if (!heading || !('end' in heading)) return null;
    if (heading.name !== 'gd_scene' && heading.name !== 'gd_resource') return null;

    const field = heading.fields.find(({ key }) => key === 'format');
    // `parseGodotFloat`, not `Number`: `Number` reads `2e` and `1e-`, which Godot loads, as NaN.
    const parsed =
      field === undefined ? null : parseGodotFloat(formatText(content.slice(field.start, field.end)));
    // `format_version = tag.fields["format"]` (`resource_format_text.cpp:1140`) is an
    // `int` (`resource_format_text.h:68`), so `format=2.0` truncates to format 2.
    // `1e999`, `inf` and `nan` read as non-finite, and this check folds them to `null`.
    const format = parsed !== null && Number.isFinite(parsed) ? Math.trunc(parsed) : null;
    return { format, line, column: written.indexOf('[') + 1 };
  }
  return null;
}

/** The number text of a `format=` field: a string's content, as an `int` reads a String's digits. */
function formatText(field: string): string {
  const value = strToVar(field);
  return value?.type === VARIANT_TYPE.STRING ? value.value : field;
}
