/**
 * A rule reads an array count through `ruleCount` where the count's validator refuses a negative.
 * `ERR_FAIL_COND(p_count < 0)` keeps the loaded length, so `ruleInt`'s authored -1 names a size the
 * engine never held. The registry, not the source, says which counts are refused.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { stripComments } from '@textscene/dev-kit';
import { allSourceFiles, declaredRuleNames, srcRoot } from './testing/ruleNameScrape.js';
import { ruleRegistry } from './RuleRegistry.js';
import { validatorRegistry } from './ValidatorRegistry.js';
import { NODE_BASE_TYPES } from '../godot/nodeBaseTypes.js';
import './index.js'; // side-effect: every slice registers its rules and validators

/** A file's `src/`-relative path, the form every result below is reported in. */
const label = (file: string): string => relative(srcRoot, file).replaceAll('\\', '/');

type Reader = 'ruleInt' | 'ruleCount';

/** One call to an integer reader, and the text of its first argument. */
interface ReaderCall {
  reader: Reader;
  argument: string;
}

/** Each `ruleInt(…)` and `ruleCount(…)` call in `src`, with its first argument. */
function readerCalls(src: string): ReaderCall[] {
  const calls: ReaderCall[] = [];
  for (const match of src.matchAll(/\b(ruleInt|ruleCount)\(/g)) {
    const start = match.index + match[0].length;
    let depth = 0;
    let end = start;
    for (; end < src.length; end++) {
      const c = src[end];
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') {
        if (depth === 0) break;
        depth--;
      } else if (c === ',' && depth === 0) break;
    }
    calls.push({ reader: match[1] as Reader, argument: src.slice(start, end).trim() });
  }
  return calls;
}

/** A count key read by name: `props.item_count` or `properties['setting_count']`. */
const COUNT_ACCESS = /(?:\.|\[\s*['"])(\w+_count)\b/;

/**
 * A key an `indexedKeyRegex` shape admits, every index position 0: `^settings/(#)/joint_count$`
 * gives `settings/0/joint_count`. Null for a shape with a group or an alternation left, which names
 * no single key.
 */
function concreteKey(shape: string): string | null {
  const key = shape.replace(/^\^/, '').replace(/\$$/, '').replaceAll('(#)', '0').replaceAll('#', '0');
  return /^[\w/]+$/.test(key) ? key : null;
}

/**
 * The count key a reader call reads, followed through one binding: the argument itself, the
 * initialiser of the name it passes (`const countRaw = rawProps.item_count`), or the
 * `indexedKeyRegex` shape a loop key is matched against before `properties[key]` is read. Null when
 * none of them names a count, so the call is not a count read.
 */
function countKeyRead(argument: string, src: string): string | null {
  const direct = COUNT_ACCESS.exec(argument);
  if (direct) return direct[1]!;

  const name = /^([A-Za-z_]\w*)$/.exec(argument)?.[1];
  if (name) {
    const initialiser = new RegExp(String.raw`\b(?:const|let)\s+${name}\s*=\s*([^;]+);`).exec(src)?.[1];
    const bound = initialiser === undefined ? null : COUNT_ACCESS.exec(initialiser);
    if (bound) return bound[1]!;
  }

  const keyName = /\[\s*([A-Za-z_]\w*)\s*\]$/.exec(argument)?.[1];
  if (keyName) {
    const tested = new RegExp(String.raw`\b([A-Za-z_]\w*)\.(?:exec|test)\(\s*${keyName}\s*\)`, 'g');
    for (const [, regexName] of src.matchAll(tested)) {
      const shape = new RegExp(String.raw`\b${regexName}\s*=\s*indexedKeyRegex\(\s*'([^']*)'`).exec(src)?.[1];
      if (shape?.includes('_count')) return concreteKey(shape);
    }
  }
  return null;
}

/** Every node type a rule declared in `file` runs on, by its list or by its matcher. */
function ruleTypes(file: string): string[] {
  const types = new Set<string>();
  for (const name of declaredRuleNames(file)) {
    const meta = ruleRegistry.getRule(name)?.meta;
    for (const type of meta?.applicableNodeTypes ?? []) types.add(type);
    const matcher = meta?.applicableNodeTypeMatcher;
    if (matcher) for (const type of Object.keys(NODE_BASE_TYPES)) if (matcher(type)) types.add(type);
  }
  return [...types];
}

/** Whether `type`'s validator for `key` refuses a negative count at the error tier and takes 0. */
function refusesNegative(type: string, key: string): boolean {
  const validator = validatorRegistry.findValidator(type, key);
  return (
    validator !== null &&
    validator(key, '0', 1) === null &&
    validator(key, '-1', 1)?.severity === 'error'
  );
}

/** One count read in a rule file, and whether the count's validator refuses a negative. */
interface CountRead {
  rel: string;
  reader: Reader;
  key: string;
  refused: boolean;
}

describe('rule-layer count reads', () => {
  const reads: CountRead[] = allSourceFiles()
    .map((file) => ({ file, src: stripComments(readFileSync(file, 'utf8')) }))
    .filter(({ src }) => /ruleRegistry\.register\(/.test(src))
    .flatMap(({ file, src }) => {
      const types = ruleTypes(file);
      return readerCalls(src).flatMap(({ reader, argument }) => {
        const key = countKeyRead(argument, src);
        if (key === null) return [];
        const refused = types.some((type) => refusesNegative(type, key));
        return [{ rel: label(file), reader, key, refused }];
      });
    });

  it('resolves the counts the rules read, so the sweep cannot pass vacuously', () => {
    const refused = reads.filter((read) => read.refused);
    // Far below the real count: this catches a resolver or registry probe that broke.
    expect(refused.length).toBeGreaterThan(8);
    // Both resolution paths, on the slice that once read both through `ruleInt`.
    expect(refused).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rel: 'nodes/3d/skeleton/bonetwistdisperser3d/linter.ts', key: 'setting_count' }),
        expect.objectContaining({
          rel: 'nodes/3d/skeleton/bonetwistdisperser3d/linter.ts',
          key: 'settings/0/joint_count',
        }),
      ])
    );
  });

  it('reads every count its validator refuses below zero through ruleCount', () => {
    const offenders = reads
      .filter((read) => read.refused && read.reader === 'ruleInt')
      .map(({ rel, key }) => `${rel}: ruleInt reads ${key}`)
      .sort();
    expect(offenders).toEqual([]);
  });

  /**
   * A fence, not a regression test: the three spellings a count read takes, and a non-count read
   * the resolver must leave alone.
   */
  it('follows a count read through each spelling, and ignores a read of anything else', () => {
    expect(countKeyRead('rawProps.item_count', '')).toBe('item_count');
    expect(countKeyRead("properties['setting_count'] ?? ''", '')).toBe('setting_count');
    expect(countKeyRead('countRaw', 'const countRaw = rawProps.tab_count;')).toBe('tab_count');
    const loop =
      "const JOINT_COUNT_KEY_RE = indexedKeyRegex('^settings/(#)/joint_count$', 'to_int');\n" +
      'for (const key of Object.keys(properties)) { const match = JOINT_COUNT_KEY_RE.exec(key); }';
    expect(countKeyRead('properties[key]', loop)).toBe('settings/0/joint_count');

    expect(countKeyRead('rawProps.current_tab', '')).toBeNull();
    expect(countKeyRead('raw', 'const raw = leaves.get("z_index");')).toBeNull();
    expect(readerCalls('ruleInt(props[window.min], window.minDefault)')).toEqual([
      { reader: 'ruleInt', argument: 'props[window.min]' },
    ]);
  });
});
