/** The ids a re-homed reference had in the file that wrote it, for the inspector. */
import { describe, expect, it } from 'vitest';
import { authoredSpelling, composeAuthoredIds, unionAuthoredIds, type AuthoredIds } from './authoredIds';

const ids = (external: [string, string][], internal: [string, string][] = []): AuthoredIds => ({
  ExtResource: new Map(external),
  SubResource: new Map(internal),
});

describe('authoredSpelling', () => {
  it('spells a renamed reference with the id its file wrote', () => {
    expect(authoredSpelling('ExtResource("1 (outer)")', ids([['1 (outer)', '1']]))).toBe('ExtResource("1")');
  });

  it('keeps a reference that was never renamed', () => {
    expect(authoredSpelling('ExtResource("2")', ids([['1 (outer)', '1']]))).toBe('ExtResource("2")');
  });

  it('keeps the text as is without renames', () => {
    expect(authoredSpelling('ExtResource("1 (outer)")', undefined)).toBe('ExtResource("1 (outer)")');
  });

  it('reads the map of the reference kind', () => {
    expect(
      authoredSpelling('SubResource("a (outer)")', ids([['a (outer)', 'x']], [['a (outer)', 'a']]))
    ).toBe('SubResource("a")');
  });
});

describe('composeAuthoredIds', () => {
  it('traces a second rename back to the id the first file wrote', () => {
    const composed = composeAuthoredIds(ids([['1 (outer)', '1']]), ids([['1 (outer) (outer)', '1 (outer)']]));

    expect(composed?.ExtResource.get('1 (outer) (outer)')).toBe('1');
  });

  it('keeps an earlier rename the later one leaves alone', () => {
    const composed = composeAuthoredIds(ids([['1 (outer)', '1']]), ids([['2 (outer)', '2']]));

    expect(composed?.ExtResource.get('1 (outer)')).toBe('1');
  });

  it('returns the one side that renames', () => {
    const earlier = ids([['1 (outer)', '1']]);

    expect(composeAuthoredIds(earlier, undefined)).toBe(earlier);
  });
});

describe('unionAuthoredIds', () => {
  it('keeps the renames of both sides without tracing one through the other', () => {
    const union = unionAuthoredIds(ids([['3 (outer)', '3']]), ids([['5 (outer)', '3 (outer)']]));

    expect(union?.ExtResource.get('5 (outer)')).toBe('3 (outer)');
    expect(union?.ExtResource.get('3 (outer)')).toBe('3');
  });

  it('returns undefined when neither side renames', () => {
    expect(unionAuthoredIds(undefined, undefined)).toBeUndefined();
  });
});
