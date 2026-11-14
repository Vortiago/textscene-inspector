/**
 * Any text gets an answer: random characters, random tokens, valid shaders with one change and
 * long repeats each end with a transpiled shader or a `ShadingLanguageError`, within a time limit. A tree the parser
 * gives passes the tree check and prints as text that parses to the same tree.
 */

import { describe, expect, it } from 'vitest';
import { DEPTH_MESSAGE, LENGTH_MESSAGE, MAX_EXPRESSION_DEPTH } from './expressionLimits.js';
import { parse } from './parse.js';
import { printShader } from './printer.js';
import { ShadingLanguageError } from './shadingLanguageError.js';
import { tokenize } from './tokenizer.js';
import { transpileShadingLanguage } from './transpile.js';
import { treeFault } from './treeCheck.js';

/** The longest one text may take, far above the few milliseconds a short text takes. */
const TIME_LIMIT_MS = 500;

const CASES_PER_KIND = 400;

/** A seeded random source (mulberry32), so a failing case repeats. */
function randomSource(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 2 ** 32;
  };
}

const pick = <T>(random: () => number, items: readonly T[]): T => items[Math.floor(random() * items.length)]!;

const CHARACTERS = [...'abcfxyzw0123456789.eEuU+-*/%<>=!&|^~?:;,(){}[]# \n\t_"\'\\é∑'];

const TOKENS = [
  'float',
  'vec2',
  'vec3',
  'vec4',
  'int',
  'ivec3',
  'uint',
  'uvec2',
  'bool',
  'bvec4',
  'mat2',
  'mat3',
  'mat4',
  'void',
  'lowp',
  'highp',
  'const',
  'in',
  'out',
  'return',
  'if',
  'struct',
  'uniform',
  'true',
  'false',
  'a',
  'b',
  'f',
  'x',
  'xy',
  'rgba',
  '0',
  '1',
  '2147483648',
  '4294967295u',
  '1.5',
  '1e39',
  '.5',
  '0x1f',
  '+',
  '-',
  '*',
  '/',
  '%',
  '<<',
  '>>',
  '&',
  '|',
  '^',
  '~',
  '!',
  '&&',
  '||',
  '==',
  '!=',
  '<',
  '>=',
  '=',
  '+=',
  '<<=',
  '++',
  '--',
  '?',
  ':',
  ';',
  ',',
  '.',
  '(',
  ')',
  '{',
  '}',
  '[',
  ']',
];

/** Valid shaders the third kind changes once each. */
const VALID_SHADERS = [
  'vec2 f(vec2 a, float b) { return a * b + vec2(1.0, -2.0).yx; }',
  'ivec3 f(ivec3 a, int b) { a.zx *= b; a[1] = b << 2; return a ^ ivec3(7); }',
  'bool f(bool c, uint a) { return c && a > 3u || !c; }',
  'mat3 f(mat3 m, vec3 v, bool c) { m[1] = c ? v : -v; return m * 2.0; }',
  'float f(float a) { ; return a++ + --a; }',
];

function randomCharacters(random: () => number): string {
  return Array.from({ length: Math.floor(random() * 80) }, () => pick(random, CHARACTERS)).join('');
}

function randomTokens(random: () => number): string {
  return Array.from({ length: Math.floor(random() * 40) }, () => pick(random, TOKENS)).join(' ');
}

/** A valid shader with one change: a character removed, a token put in, or two characters swapped. */
function changedShader(random: () => number): string {
  const text = pick(random, VALID_SHADERS);
  const at = Math.floor(random() * text.length);
  const change = Math.floor(random() * 3);
  if (change === 0) return text.slice(0, at) + text.slice(at + 1);
  if (change === 1) return `${text.slice(0, at)} ${pick(random, TOKENS)} ${text.slice(at)}`;
  const other = Math.floor(random() * text.length);
  const characters = [...text];
  [characters[at], characters[other]] = [characters[other]!, characters[at]!];
  return characters.join('');
}

/**
 * One character or token repeated thousands of times, then a random token: the shape of text on
 * which a pattern that can match one run in many ways backtracks for long.
 */
function longRepeat(random: () => number): string {
  const unit = random() < 0.5 ? pick(random, CHARACTERS) : `${pick(random, TOKENS)} `;
  return unit.repeat(1_000 + Math.floor(random() * 19_000)) + pick(random, TOKENS);
}

/** The answer to `text`: `accepted`, or Godot's or the transpiler's reason. Any other error throws. */
function answer(text: string): string {
  try {
    transpileShadingLanguage(text);
    return 'accepted';
  } catch (error) {
    if (error instanceof ShadingLanguageError) return error.reason;
    throw new Error(`expected a ShadingLanguageError for ${JSON.stringify(text)}, got ${String(error)}`, {
      cause: error,
    });
  }
}

/** A tree the parser gives passes the tree check and survives a print. */
function expectSoundTree(text: string): void {
  let tree;
  try {
    tree = parse(tokenize(text));
  } catch {
    // The parser refused the text, which `answer` already checked.
    return;
  }
  expect(treeFault(tree), text).toBeUndefined();
  const printed = printShader(tree);
  expect(printShader(parse(tokenize(printed))), text).toBe(printed);
}

describe.each([
  ['random characters', randomCharacters, 1],
  ['random tokens', randomTokens, 2],
  ['valid shaders with one change', changedShader, 3],
  ['long repeats of one character or token', longRepeat, 4],
] as const)('%s', (_, generate, seed) => {
  it('each get an answer in time, and each tree they give is sound', () => {
    const random = randomSource(seed);
    for (let index = 0; index < CASES_PER_KIND; index += 1) {
      const text = generate(random);
      const startedAt = performance.now();
      answer(text);
      expect(performance.now() - startedAt, text).toBeLessThan(TIME_LIMIT_MS);
      expectSoundTree(text);
    }
  });
});

describe('the expression limits', () => {
  it('refuses brackets nested past the depth limit', () => {
    const depth = MAX_EXPRESSION_DEPTH * 40;
    expect(answer(`float f(float a) { return ${'('.repeat(depth)}a${')'.repeat(depth)}; }`)).toBe(
      DEPTH_MESSAGE
    );
  });

  it('refuses a chain of operators deeper than the limit', () => {
    expect(answer(`float f(float a) { return a${' + a'.repeat(MAX_EXPRESSION_DEPTH)}; }`)).toBe(
      DEPTH_MESSAGE
    );
  });

  it('refuses a list too long to reduce in time', () => {
    expect(answer(`float f(float a) { return a${' + a'.repeat(100_000)}; }`)).toBe(LENGTH_MESSAGE);
  });

  it('reads a chain just inside the limit', () => {
    expect(answer(`float f(float a) { return a${' + a'.repeat(MAX_EXPRESSION_DEPTH - 2)}; }`)).toBe(
      'accepted'
    );
  });
});
