/**
 * The scan's own completeness, which the parity guard cannot check for itself.
 *
 * `getInheritedParserProps` throws when a MAPPED ancestor's parser file has
 * moved, so the table is held against staleness. Incompleteness is the other
 * half and is silent: an ancestor absent from `BASE_TYPE_TO_PARSER_SUBPATH` is
 * skipped, and every key only that ancestor's parser reads then reads as
 * linter-only on each descendant — a validator desync where the parser is fine.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { baseChain, NODE_BASE_TYPES } from '../nodeBaseTypes.js';
import { walk } from './ruleNameScrape.js';
import {
  BASE_TYPE_TO_PARSER_SUBPATH,
  extractNodeType,
  findLinterParserDirs,
  findSliceDirs,
  nodesRoot,
} from './propertyGrammarParityScan.js';

/** The node type each `linterParser.ts` speaks for, keyed by its directory. */
const typeOf = (dir: string): string | null =>
  extractNodeType(readFileSync(join(dir, 'linterParser.ts'), 'utf8'));

/**
 * Type -> the directory whose `parser.ts` reads for it.
 *
 * Two sources, because a base parser need not sit beside a `linterParser.ts`:
 * `panelcontainer/` holds a parser and registers no validators of its own, and
 * a directory named for its type is the only handle on that case.
 */
function parserDirLookup(): (type: string) => string | undefined {
  const byDirName = new Map<string, string>();
  for (const file of walk(nodesRoot, 'parser.ts')) {
    const dir = dirname(file);
    byDirName.set(basename(dir).toLowerCase(), dir);
  }
  const byDeclaredType = new Map<string, string>();
  for (const dir of findLinterParserDirs(nodesRoot)) {
    const type = typeOf(dir);
    if (type && existsSync(join(dir, 'parser.ts'))) byDeclaredType.set(type, dir);
  }
  return (type) => byDeclaredType.get(type) ?? byDirName.get(type.toLowerCase());
}

describe('base-parser lookup', () => {
  const parserDirOf = parserDirLookup();

  it('names every ancestor a swept slice inherits a parser from', () => {
    const missing = new Set<string>();
    for (const dir of findSliceDirs(nodesRoot)) {
      const type = typeOf(dir);
      if (!type) continue;
      for (const base of baseChain(type)) {
        if (base in BASE_TYPE_TO_PARSER_SUBPATH) continue;
        const baseDir = parserDirOf(base);
        if (baseDir) {
          missing.add(`${base} (${relative(nodesRoot, baseDir)}/parser.ts), inherited by ${type}`);
        }
      }
    }
    const rows = [...missing].sort();
    expect(
      rows,
      `These ancestors own a parser.ts that BASE_TYPE_TO_PARSER_SUBPATH does not name,\n` +
        `so their reads are invisible to every descendant:\n  ${rows.join('\n  ')}`
    ).toEqual([]);
  });

  it('points every mapped subpath at a file that exists', () => {
    const gone = Object.entries(BASE_TYPE_TO_PARSER_SUBPATH)
      .filter(([, subpath]) => !existsSync(join(nodesRoot, subpath)))
      .map(([base, subpath]) => `${base} -> ${subpath}`);
    expect(gone).toEqual([]);
  });

  it('keys the table on classes the base table knows', () => {
    // A hop keyed on a name no base chain ever yields is dead weight, and it
    // hides a rename of the type rather than of the file the arm above checks.
    const unknown = Object.keys(BASE_TYPE_TO_PARSER_SUBPATH).filter(
      (base) => base !== 'Node' && NODE_BASE_TYPES[base] === undefined
    );
    expect(unknown).toEqual([]);
  });
});
