/**
 * Foldable blocks: one per heading whose body reaches past its heading line. Each ends
 * at the next heading, so the ranges are adjacent rather than nested.
 */

import type { LanguageDocument } from './document.js';
import type { FoldingRange } from './types.js';

/** Every fold in the document, one per non-empty section body. */
export function foldingRanges(document: LanguageDocument): readonly FoldingRange[] {
  const ranges: FoldingRange[] = [];
  for (const section of document.sections) {
    if (section.kind === 'other') continue;
    if (section.endLine <= section.headingLine) continue;
    ranges.push({ startLine: section.headingLine - 1, endLine: section.endLine - 1, kind: 'region' });
  }
  return ranges;
}
