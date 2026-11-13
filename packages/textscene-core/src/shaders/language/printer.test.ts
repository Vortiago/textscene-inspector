/** The printer writes text the parser reads as the same tree. */

import { describe, expect, it } from 'vitest';
import { treeOf } from './parsedTree.testkit.js';
import { printShader } from './printer.js';
import type { ShaderNode } from './shaderTree.js';

/** `tree` without the positions, which differ between a text and its printed form. */
const shapeOf = (tree: ShaderNode): unknown =>
  JSON.parse(JSON.stringify(tree, (key: string, value: unknown) => (key === 'position' ? undefined : value)));

describe('printShader', () => {
  it('writes each operator in brackets', () => {
    expect(printShader(treeOf('float f(float a, float b) { return a + b * a; }'))).toBe(
      'float f(float a, float b) {\n\treturn (a + (b * a));\n}'
    );
  });

  it.each([
    ['a negative scalar constant', 'float f(float a) { return a + float(-1.5); }'],
    ['the smallest int', 'int f(int a) { return a + int(-2147483648); }'],
    ['a negated constant in a ternary part', 'vec2 f(bool c) { return c ? -vec2(1.0, 2.0) : vec2(3.0); }'],
    ['a double negation in a ternary part', 'float f(bool c) { return c ? -(-1.0) : 3.0; }'],
    ['a negated constructor in a sum', 'vec2 f(vec2 a) { return a + -vec2(1.0, 2.0); }'],
    ['an assignment chain', 'int f(int a, int b) { a = b = a + b; return a; }'],
    ['a swizzle of a negation', 'vec2 f(vec2 a) { return (-a).yx; }'],
    ['a float that needs every digit', 'float f() { return 0.1 + 1e-40; }'],
    ['a matrix constant', 'mat2 f() { return mat2(2.0); }'],
    ['an empty statement and a step', 'ivec2 f(ivec2 a) { ; a.x++; return --a; }'],
  ])('keeps %s', (_, source) => {
    const tree = treeOf(source);
    expect(shapeOf(treeOf(printShader(tree)))).toEqual(shapeOf(tree));
  });
});
