import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { forkedCopies, readStamp, sha256OfText, stamped } from './verktoykasse.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const STAMP = '# canonical source: a/b.sh@abc sha256:' + 'f'.repeat(64) + ' - vendored copy, do not edit here';

describe('vendored Verktøykasse copies', () => {
  it('each copy still matches the canon bytes its stamp records', () => {
    expect(forkedCopies()).toEqual([]);
  });

  it('the vendored Conventional Commits validator passes its own self-test', () => {
    const selftest = resolve(REPO_ROOT, '.claude/skills/conventional-commits/selftest.sh');
    expect(() => execFileSync('sh', [selftest], { stdio: 'pipe' })).not.toThrow();
  });
});

describe('stamped', () => {
  it('keeps a shebang on the first line', () => {
    expect(stamped('#!/bin/sh\necho hi\n', STAMP).split('\n').slice(0, 2)).toEqual(['#!/bin/sh', STAMP]);
  });

  it('keeps a frontmatter block first', () => {
    const lines = stamped('---\nname: x\n---\nbody\n', STAMP).split('\n');
    expect(lines.slice(0, 4)).toEqual(['---', 'name: x', '---', STAMP]);
  });

  it('puts the stamp on the first line of a plain file', () => {
    expect(stamped('# Title\n', STAMP).split('\n')[0]).toBe(STAMP);
  });
});

describe('readStamp', () => {
  it('returns the canon text when the stamp is removed', () => {
    const canon = '#!/bin/sh\necho hi\n';
    const stamp = `# canonical source: a/b.sh@abc sha256:${sha256OfText(canon)} - vendored copy, do not edit here`;
    const read = readStamp(stamped(canon, stamp));
    expect(read).toMatchObject({ canon: 'a/b.sh', rev: 'abc', body: canon });
    expect(sha256OfText(read.body)).toBe(read.sha);
  });

  it('finds no stamp in a file without one', () => {
    expect(readStamp('echo hi\n')).toBeNull();
  });
});

describe('sha256OfText', () => {
  it('hashes CRLF and LF text the same', () => {
    expect(sha256OfText('a\r\nb\r\n')).toBe(sha256OfText('a\nb\n'));
  });
});
