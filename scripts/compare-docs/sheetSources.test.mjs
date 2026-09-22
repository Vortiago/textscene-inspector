/**
 * `findCommentedFrontmatterKeys` — the detector for a key hidden behind a `#`
 * comment (see the export's own doc comment for why that shape is dangerous:
 * `parseFrontmatter` cannot see it, but a human reading the raw file can).
 */

import { describe, expect, it } from 'vitest';
import { findCommentedFrontmatterKeys } from './sheetSources.mjs';

const sheet = (frontmatter, body = '\n# Title\n\nProse.\n') => `---\n${frontmatter}\n---\n${body}`;

describe('findCommentedFrontmatterKeys', () => {
  it('finds a commented-out key inside the frontmatter block (happy path)', () => {
    const text = sheet('type: Foo\ncategory: 3D\n# image: unit-foo\nstatus: unreviewed');
    expect(findCommentedFrontmatterKeys(text)).toEqual(['image']);
  });

  it('finds every commented key when more than one is hidden', () => {
    const text = sheet('type: Foo\n# image: unit-foo\n# camera: Cam3D');
    expect(findCommentedFrontmatterKeys(text)).toEqual(['image', 'camera']);
  });

  it('returns empty for a sheet with no frontmatter block at all (error path)', () => {
    expect(findCommentedFrontmatterKeys('# Just a heading\n\nNo frontmatter here.\n')).toEqual([]);
  });

  it('ignores a live, uncommented key (edge case)', () => {
    const text = sheet('type: Foo\nimage: unit-foo');
    expect(findCommentedFrontmatterKeys(text)).toEqual([]);
  });

  it('ignores a `#` heading in the body, outside the frontmatter block', () => {
    const text = sheet('type: Foo\ncategory: 3D', '\n# image: this is a heading, not a key\n');
    expect(findCommentedFrontmatterKeys(text)).toEqual([]);
  });

  it('ignores an inline trailing comment on a live key (not a fully commented line)', () => {
    // `category: 3D  # 3D | 2D | Resources | Other` — SHEET-STANDARD's own
    // inline-comment style — is a live key with a trailing note, not a hidden one.
    const text = sheet('type: Foo\ncategory: 3D  # 3D | 2D | Resources | Other');
    expect(findCommentedFrontmatterKeys(text)).toEqual([]);
  });
});
