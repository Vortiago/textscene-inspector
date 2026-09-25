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

/** One call to an integer reader, the text of its first argument, and where the call starts. */
interface ReaderCall {
  reader: Reader;
  argument: string;
  at: number;
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
    calls.push({
      reader: match[1] as Reader,
      argument: src.slice(start, end).trim(),
      at: match.index,
    });
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
 * The `{` offset of every block that encloses `at`, innermost first, then -1 for the module. Braces
 * are counted in comment-stripped text, so a brace inside a string or a regex literal would skew
 * it. No rule file spells one unbalanced, and the fence below pins the scoping.
 */
function enclosingBlocks(src: string, at: number): number[] {
  const open: number[] = [];
  for (let i = 0; i < at; i++) {
    if (src[i] === '{') open.push(i);
    else if (src[i] === '}') open.pop();
  }
  return [...open.reverse(), -1];
}

/**
 * The initialiser of the `const` or `let` binding of `name` in scope at `at`: the last one written
 * before `at` directly in the innermost block that declares it. A binding of the same name in
 * another function, or in a sibling block, is out of scope.
 */
function bindingInScope(src: string, name: string, at: number): string | undefined {
  const declaration = new RegExp(String.raw`\b(?:const|let)\s+${name}\s*=\s*([^;]+);`, 'g');
  const candidates = [...src.matchAll(declaration)].filter((m) => m.index < at);
  for (const block of enclosingBlocks(src, at)) {
    const own = candidates.filter((m) => enclosingBlocks(src, m.index)[0] === block);
    if (own.length > 0) return own[own.length - 1]![1];
  }
  return undefined;
}

/**
 * The count key a reader call at `at` reads, followed through one binding in scope: the argument
 * itself, the initialiser of the name it passes (`const countRaw = rawProps.item_count`), or the
 * `indexedKeyRegex` shape a loop key is matched against before `properties[key]` is read. Null when
 * none of them names a count, so the call is not a count read.
 */
function countKeyRead(argument: string, src: string, at: number): string | null {
  const direct = COUNT_ACCESS.exec(argument);
  if (direct) return direct[1]!;

  const name = /^([A-Za-z_]\w*)$/.exec(argument)?.[1];
  if (name) {
    const initialiser = bindingInScope(src, name, at);
    const bound = initialiser === undefined ? null : COUNT_ACCESS.exec(initialiser);
    if (bound) return bound[1]!;
  }

  const keyName = /\[\s*([A-Za-z_]\w*)\s*\]$/.exec(argument)?.[1];
  if (keyName) {
    // The match that names the loop key, in the innermost block around the call that holds one.
    const tested = new RegExp(String.raw`\b([A-Za-z_]\w*)\.(?:exec|test)\(\s*${keyName}\s*\)`, 'g');
    for (const block of enclosingBlocks(src, at)) {
      const inBlock = [...src.matchAll(tested)].filter(
        (m) => m.index > block && m.index < at && enclosingBlocks(src, m.index).includes(block)
      );
      for (const [, regexName] of inBlock) {
        const initialiser = bindingInScope(src, regexName!, at);
        const shape = /^indexedKeyRegex\(\s*'([^']*)'/.exec(initialiser?.trim() ?? '')?.[1];
        if (shape?.includes('_count')) return concreteKey(shape);
      }
      if (inBlock.length > 0) break;
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
      return readerCalls(src).flatMap(({ reader, argument, at }) => {
        const key = countKeyRead(argument, src, at);
        if (key === null) return [];
        const refused = types.some((type) => refusesNegative(type, key));
        return [{ rel: label(file), reader, key, refused }];
      });
    });

  it('resolves the counts the rules read, so the sweep cannot pass vacuously', () => {
    const refused = reads.filter((read) => read.refused);
    // Far below the real count, so it fails only when the resolver or the registry probe breaks.
    expect(refused.length).toBeGreaterThan(8);
    // Both resolution paths: a direct `setting_count` read, and a `joint_count` through a loop key.
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
   * the resolver must leave alone. `at` is the end of the snippet, where the call would be.
   */
  it('follows a count read through each spelling, and ignores a read of anything else', () => {
    expect(countKeyRead('rawProps.item_count', '', 0)).toBe('item_count');
    expect(countKeyRead("properties['setting_count'] ?? ''", '', 0)).toBe('setting_count');
    const bound = 'const countRaw = rawProps.tab_count;';
    expect(countKeyRead('countRaw', bound, bound.length)).toBe('tab_count');
    const loop =
      "const JOINT_COUNT_KEY_RE = indexedKeyRegex('^settings/(#)/joint_count$', 'to_int');\n" +
      'for (const key of Object.keys(properties)) { const match = JOINT_COUNT_KEY_RE.exec(key); ';
    expect(countKeyRead('properties[key]', loop, loop.length)).toBe('settings/0/joint_count');

    expect(countKeyRead('rawProps.current_tab', '', 0)).toBeNull();
    const other = 'const raw = leaves.get("z_index");';
    expect(countKeyRead('raw', other, other.length)).toBeNull();
    expect(readerCalls('ruleInt(props[window.min], window.minDefault)')).toEqual([
      { reader: 'ruleInt', argument: 'props[window.min]', at: 0 },
    ]);
  });

  it('reads the binding in scope at the call, not one of the same name elsewhere', () => {
    const inB =
      'function a() { const raw = props.item_count; }\nfunction b() { const raw = leaves.get("z"); ';
    expect(countKeyRead('raw', inB, inB.length)).toBeNull();
    const inA =
      'function b() { const raw = leaves.get("z"); }\nfunction a() { const raw = props.item_count; ';
    expect(countKeyRead('raw', inA, inA.length)).toBe('item_count');
  });

  it('reads the binding of the innermost block that declares the name', () => {
    const shadowed =
      'function a() { const raw = props.item_count; for (const x of y) { const raw = x.z; ';
    expect(countKeyRead('raw', shadowed, shadowed.length)).toBeNull();
    const outer = 'function a() { const raw = props.item_count; for (const x of y) { ';
    expect(countKeyRead('raw', outer, outer.length)).toBe('item_count');
  });
});
