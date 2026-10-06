import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './repoRoot.mjs';
import { sharedAdrNumbers } from './adrNumbers.mjs';

describe('sharedAdrNumbers', () => {
  it('finds no shared number when each file has its own', () => {
    expect(sharedAdrNumbers(['0001-a.md', '0002-b.md'])).toEqual(new Map());
  });

  it('names every file that shares a number', () => {
    const shared = sharedAdrNumbers(['0032-a.md', '0033-b.md', '0032-c.md']);

    expect(shared).toEqual(new Map([['0032', ['0032-a.md', '0032-c.md']]]));
  });

  it('ignores a file that is not a numbered ADR', () => {
    expect(sharedAdrNumbers(['README.md', 'template.md', '0001-a.md'])).toEqual(new Map());
  });
});

describe('docs/adr', () => {
  it('gives every ADR a unique number, so an ADR-NNNN cite names one file', () => {
    const files = readdirSync(join(REPO_ROOT, 'docs/adr'));

    expect(sharedAdrNumbers(files)).toEqual(new Map());
  });
});
