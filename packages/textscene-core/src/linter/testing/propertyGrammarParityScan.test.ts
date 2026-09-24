/**
 * The scan's own completeness, which the parity guard cannot check. An ancestor
 * absent from `BASE_TYPE_TO_PARSER_SUBPATH` is skipped silently, so every key
 * only its parser reads shows as linter-only on each descendant. A moved mapped
 * parser already throws in `getInheritedParserProps`.
 */

import { afterAll, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative } from 'node:path';
import { baseChain, NODE_BASE_TYPES } from '../../godot/nodeBaseTypes.js';
import { walk } from './ruleNameScrape.js';
import {
  BASE_TYPE_TO_PARSER_SUBPATH,
  extractNodeType,
  findLinterParserDirs,
  findSliceDirs,
  nodesRoot,
  scrapeParserReads,
} from './propertyGrammarParityScan.js';

/** The node type each `linterParser.ts` speaks for, keyed by its directory. */
const typeOf = (dir: string): string | null =>
  extractNodeType(readFileSync(join(dir, 'linterParser.ts'), 'utf8'));

/**
 * Type to the directory whose `parser.ts` reads for it. Two sources, because a
 * base parser need not sit beside a `linterParser.ts`: `panelcontainer/` has a
 * parser and no validators, so only its directory name identifies it.
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

describe('scrapeParserReads', () => {
  // A seeded tree, so the follow rule is pinned on its own shape rather than
  // on which helpers the real parsers delegate to.
  const root = mkdtempSync(join(tmpdir(), 'parity-scan-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  const seed = (files: Record<string, string>): string => {
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(dirname(join(root, rel)), { recursive: true });
      writeFileSync(join(root, rel), body);
    }
    return join(root, 'slice/parser.ts');
  };

  it('follows a relative import handed the whole property bag, in any argument position', () => {
    const parser = seed({
      'slice/parser.ts': [
        "import { parseHelperBase } from '../shared/helper';",
        "import { parseNode } from '../node/parser.js';",
        'export const parse = (heading, properties) => ({',
        '  ...parseNode(heading, properties),',
        "  ...parseHelperBase(properties, 'Slice'),",
        '  own: properties.own_key,',
        '});',
      ].join('\n'),
      'shared/helper.ts': [
        "import { parseDeeper } from './deeper.js';",
        'export const parseHelperBase = (properties) => ({',
        '  helper: properties.helper_key, ...parseDeeper(properties) });',
      ].join('\n'),
      'shared/deeper.ts': "export const parseDeeper = (properties) => ({ deep: properties.deep_key });",
      'node/parser.ts': "export const parseNode = (heading, properties) => ({ base: properties.base_key });",
    });
    expect([...scrapeParserReads(parser)].sort()).toEqual([
      'base_key',
      'deep_key',
      'helper_key',
      'own_key',
    ]);
  });

  it('ignores an imported name that is never called with the bag, and a bare specifier', () => {
    const parser = seed({
      'slice/parser.ts': [
        "import { floatOr } from '../shared/values';",
        "import { parseFromPackage } from 'some-package';",
        'export const parse = (heading, properties) => ({',
        '  a: floatOr(properties.a, 0), b: parseFromPackage(properties) });',
      ].join('\n'),
      'shared/values.ts': 'export const floatOr = (text, fallback) => text ?? fallback; // properties.never',
    });
    expect([...scrapeParserReads(parser)].sort()).toEqual(['a']);
  });

  it('terminates on an import cycle', () => {
    const parser = seed({
      'slice/parser.ts': "import { parseB } from './b'; export const parseA = (properties) => parseB(properties) ?? properties.a;",
      'slice/b.ts': "import { parseA } from './parser'; export const parseB = (properties) => parseA(properties) ?? properties.b;",
    });
    expect([...scrapeParserReads(parser)].sort()).toEqual(['a', 'b']);
  });

  it('throws on a followed import that resolves to no file', () => {
    const parser = seed({
      'slice/parser.ts': "import { parseGone } from './gone'; export const p = (properties) => parseGone(properties);",
    });
    expect(() => scrapeParserReads(parser)).toThrow(/gone/);
  });
});
