import { describe, expect, it } from 'vitest';
import { LanguageDocument } from './document';
import { SCENE } from './fixtures.testkit';
import { foldingRanges } from './folding';

describe('foldingRanges', () => {
  it('folds each section that reaches past its heading', () => {
    const ranges = foldingRanges(new LanguageDocument(SCENE));
    // The sub-resource and the two nodes have a body; the resource headings and the
    // connection do not.
    expect(ranges).toEqual([
      { startLine: 5, endLine: 6 },
      { startLine: 8, endLine: 9 },
      { startLine: 11, endLine: 13 },
    ]);
  });

  it('folds nothing in a document of bare headings', () => {
    const document = new LanguageDocument('[node name="A" type="Node"]\n[node name="B" type="Node"]');
    expect(foldingRanges(document)).toEqual([]);
  });
});
