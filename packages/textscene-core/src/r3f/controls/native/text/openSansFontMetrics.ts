/**
 * The vendored Open Sans SemiBold as a `FontMetrics`: the native text engine's default, which a
 * scene with no `Theme` or `font` override shapes against.
 */

import { decodeBase64UrlBytes } from '../../../../godot/variant/packedBytes';
import type { FontMetrics } from './fontMetrics';
import { sfntRunSubstitutions, type RunSubstitutions } from './glyphRun';
import {
  OPEN_SANS_METRICS,
  getGlyphAdvanceUnits,
  getKerningAdjustmentUnits,
  hasGlyph,
} from './openSansMetrics';
import { OPEN_SANS_SHAPING_TABLES } from './openSansShaping';
import { sfntDecomposition, type Decomposition } from './sfntDecomposition';
import { sfntFileOfTables } from './sfntTables';

/** How Open Sans shapes a run and draws a cluster it lacks, read from its baked tables. */
interface OpenSansShaping {
  readonly substitutions: RunSubstitutions | undefined;
  readonly decomposition: Decomposition | undefined;
}

/** Written once, by the first read of a shaping field of `OPEN_SANS_FONT_METRICS`. */
let shaping: OpenSansShaping | undefined;

/** The shaping of the baked tables, decoded at the first run that reads it. */
function openSansShaping(): OpenSansShaping {
  if (shaping) return shaping;
  const tables = Object.entries(OPEN_SANS_SHAPING_TABLES).map(
    ([tag, base64url]) => [tag, decodeBase64UrlBytes(base64url)] as const
  );
  const sfnt = sfntFileOfTables(new Map(tables));
  shaping = {
    substitutions: sfntRunSubstitutions(sfnt) ?? undefined,
    decomposition: sfntDecomposition(sfnt) ?? undefined,
  };
  return shaping;
}

// Every field reads through to the GENERATED `openSansMetrics.ts` (`OPEN_SANS_METRICS` and its
// accessors) with getters, not a snapshot, so a live mutation (as `textLayout.test.ts` makes to
// `.kerning`) stays visible.
export const OPEN_SANS_FONT_METRICS: FontMetrics = {
  kind: 'atlas',
  get unitsPerEm() {
    return OPEN_SANS_METRICS.unitsPerEm;
  },
  get ascent() {
    return OPEN_SANS_METRICS.ascent;
  },
  get descent() {
    return OPEN_SANS_METRICS.descent;
  },
  hasGlyph,
  getGlyphAdvanceUnits,
  getKerningAdjustmentUnits,
  get averageAdvanceUnits() {
    return OPEN_SANS_METRICS.averageAdvanceUnits;
  },
  get substitutions() {
    return openSansShaping().substitutions;
  },
  get decomposition() {
    return openSansShaping().decomposition;
  },
};
