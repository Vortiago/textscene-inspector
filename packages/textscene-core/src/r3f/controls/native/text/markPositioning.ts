/**
 * Where the marks of a cluster sit against its base, as HarfBuzz's `GPOS` mark attachment places them
 * (`MarkBasePosFormat1` and `MarkMarkPosFormat1`, `hb-ot-layout-gpos-table.hh`): each lookup of the
 * `mark` and `mkmk` features attaches a mark to the base before it, or to the mark before it, with
 * the difference of the two anchors. Mark-to-ligature, cursive attachment, and a font with no mark
 * lookups, which HarfBuzz positions by its fallback, are not read: the reader answers null.
 *
 * Portions ported from HarfBuzz ("Old MIT" licence).
 * Copyright (C) 2007-2026 by Behdad Esfahbod and the HarfBuzz contributors.
 * See THIRD-PARTY-NOTICES.md.
 */

import {
  coverageIndex,
  GposType,
  i16,
  sfntGpos,
  u16,
  type Lookup,
  type LayoutTable,
} from './autofit/openTypeLayout';
import { glyphPropsReader, lookupMatcher } from './autofit/openTypeGdef';
import { defaultSubstitution, featureLookups } from './autofit/openTypeFeatures';
import { sfntGlyphIndex } from './sfntCmap';
import type { SfntFile } from './sfntTables';

/** Where a mark's origin sits against its base's origin, in design units with y up. */
export interface MarkOffset {
  readonly x: number;
  readonly y: number;
}

/** The glyph class bit of a `GDEF` mark in the props `glyphPropsReader` gives. */
const MARK_PROPS = 0x8;

const ORIGIN: MarkOffset = { x: 0, y: 0 };

/** The scripts whose marks the reader places: the first one the font has, else its default script. */
const MARK_SCRIPT_TAGS = ['latn', 'grek', 'cyrl'] as const;

/** The `GPOS` lookups of the `mark` and `mkmk` features that attach a mark. */
function attachmentLookups(table: LayoutTable): Lookup[] {
  const lookups = featureLookups(table, MARK_SCRIPT_TAGS, ['mark', 'mkmk'], defaultSubstitution(table));
  return lookups.flatMap((index) => {
    const lookup = table.lookups[index];
    const subtables = lookup?.subtables.filter(
      ({ type }) => type === GposType.MARK_TO_BASE || type === GposType.MARK_TO_MARK
    );
    return lookup && subtables && subtables.length > 0 ? [{ ...lookup, subtables }] : [];
  });
}

/** The x and y of the anchor table at `at`, which every anchor format starts with. */
function anchorAt(dv: DataView, at: number): MarkOffset {
  return { x: i16(dv, at + 2), y: i16(dv, at + 4) };
}

/**
 * The anchors of a mark and of the glyph it attaches to, in one subtable of either type: both have
 * a coverage of each, a count of mark classes, a mark array of `(class, anchor)` records and an
 * array of attach anchors by class. Null where the subtable does not attach the pair.
 */
function anchorsOf(
  dv: DataView,
  subtable: number,
  mark: number,
  target: number
): { markAnchor: MarkOffset; targetAnchor: MarkOffset } | null {
  if (u16(dv, subtable) !== 1) return null;
  const markIndex = coverageIndex(dv, subtable + u16(dv, subtable + 2), mark);
  const targetIndex = coverageIndex(dv, subtable + u16(dv, subtable + 4), target);
  if (markIndex < 0 || targetIndex < 0) return null;
  const classCount = u16(dv, subtable + 6);
  const markArray = subtable + u16(dv, subtable + 8);
  const targetArray = subtable + u16(dv, subtable + 10);
  const markRecord = markArray + 2 + 4 * markIndex;
  const markClass = u16(dv, markRecord);
  if (markClass >= classCount) return null;
  const markAnchorOffset = u16(dv, markRecord + 2);
  const targetAnchorOffset = u16(dv, targetArray + 2 + 2 * (targetIndex * classCount + markClass));
  if (markAnchorOffset === 0 || targetAnchorOffset === 0) return null;
  return {
    markAnchor: anchorAt(dv, markArray + markAnchorOffset),
    targetAnchor: anchorAt(dv, targetArray + targetAnchorOffset),
  };
}

/** The glyph a mark attaches to, with the anchor difference that moves its origin there. */
interface Attachment {
  readonly target: number;
  readonly delta: MarkOffset;
}

/**
 * The offset of each character of a cluster from the first, in design units, or null for a font
 * with no mark lookup. The first character is the base. A mark that no lookup attaches stays at the
 * origin of the glyph before it.
 */
export type ClusterOffsets = (cluster: readonly string[]) => readonly MarkOffset[] | null;

export function markPositioningReader(sfnt: SfntFile): ClusterOffsets | null {
  const table = sfntGpos(sfnt);
  const glyphIndexOf = sfntGlyphIndex(sfnt);
  if (!table || !glyphIndexOf) return null;
  const lookups = attachmentLookups(table);
  if (lookups.length === 0) return null;
  const propsOf = glyphPropsReader(sfnt);
  const matches = lookupMatcher(sfnt);
  const { dv } = table;

  return (cluster) => {
    const glyphs = cluster.map((ch) => {
      const codePoint = ch.codePointAt(0)!;
      return { glyph: glyphIndexOf(codePoint), codePoint };
    });
    const props = glyphs.map(propsOf);
    const attachments: (Attachment | undefined)[] = glyphs.map(() => undefined);
    for (const { props: lookupProps, subtables } of lookups) {
      for (let mark = 1; mark < glyphs.length; mark++) {
        if (!(props[mark]! & MARK_PROPS) || !matches(glyphs[mark]!.glyph, props[mark]!, lookupProps))
          continue;
        const attachment = attachmentOf(mark, subtables);
        if (attachment) attachments[mark] = attachment;
      }
    }

    function attachmentOf(mark: number, subtables: Lookup['subtables']): Attachment | undefined {
      for (const { type, offset } of subtables) {
        const target = targetOf(mark, type);
        if (target < 0) continue;
        const anchors = anchorsOf(dv, offset, glyphs[mark]!.glyph, glyphs[target]!.glyph);
        if (anchors)
          return {
            target,
            delta: {
              x: anchors.targetAnchor.x - anchors.markAnchor.x,
              y: anchors.targetAnchor.y - anchors.markAnchor.y,
            },
          };
      }
      return undefined;
    }

    /** The glyph `type` attaches `mark` to: the nearest mark-skipping base, or the glyph just before it. */
    function targetOf(mark: number, type: number): number {
      if (type === GposType.MARK_TO_MARK) return props[mark - 1]! & MARK_PROPS ? mark - 1 : -1;
      for (let base = mark - 1; base >= 0; base--) if (!(props[base]! & MARK_PROPS)) return base;
      return -1;
    }

    const offsets: MarkOffset[] = [ORIGIN];
    for (let i = 1; i < glyphs.length; i++) {
      const attachment = attachments[i];
      if (!attachment) {
        offsets.push(offsets[i - 1]!);
        continue;
      }
      const target = offsets[attachment.target]!;
      offsets.push({ x: target.x + attachment.delta.x, y: target.y + attachment.delta.y });
    }
    return offsets;
  };
}
