/**
 * Godot's front end evaluates an operator whose operands' values it knows, and refuses an
 * integer division or modulo by zero. Each case is Godot 4.6.3's own verdict on the same text.
 */

import { describe, expect, it } from 'vitest';
import { ShadingLanguageError } from './shadingLanguageError.js';
import { transpileShadingLanguage } from './transpile.js';

/** `accepted`, or the reason of the refusal. */
function verdict(text: string): string {
  try {
    transpileShadingLanguage(text);
    return 'accepted';
  } catch (error) {
    if (error instanceof ShadingLanguageError) return error.reason;
    throw error;
  }
}

const intFunction = (body: string) => `int f(int a) { return ${body}; }`;

describe('the evaluation of operators of known values', () => {
  it.each([
    ['5 / (1 - 1)', 'Division by zero error.'],
    ['5 / (-0)', 'Division by zero error.'],
    ['ivec2(1, 2).x / (2 - 2)', 'accepted'],
    ['5 / -0', 'accepted'],
    ['5 / ivec2(1, 0).x', 'accepted'],
    ['5 / int(0.0)', 'accepted'],
    ['5 / (true ? 0 : 1)', 'accepted'],
    ['a /= 0', 'accepted'],
    ['a / 0', 'accepted'],
  ])('reads %s in an int function as Godot does', (body, expected) => {
    expect(verdict(intFunction(body))).toBe(expected);
  });

  it('refuses a vector divided by a zero of known value', () => {
    expect(verdict('ivec2 f() { return ivec2(1, 2) / 0; }')).toBe('Division by zero error.');
  });

  it('divides a uint vector by zero, as Godot checks only the uint scalar', () => {
    expect(verdict('uvec2 f() { return uvec2(1u) / uvec2(0u); }')).toBe('accepted');
  });

  it('refuses a uint vector modulo zero', () => {
    expect(verdict('uvec2 f() { return uvec2(1u) % uvec2(0u); }')).toBe('Modulo by zero error.');
  });

  it("gives Godot's line", () => {
    expect(() => transpileShadingLanguage('int f() {\n\treturn 1 % (3 - 3);\n}')).toThrow(
      /^2:\d+: Modulo by zero error\.$/
    );
  });
});

describe('the expressions Godot 4.6.3 aborts on', () => {
  it('refuses a mat4 times a vec4 of known values', () => {
    expect(verdict('vec4 f() { return mat4(2.0) * vec4(1.0); }')).toMatch(/^Godot 4\.6\.3 aborts/);
  });

  it('refuses the least int divided by -1 of known values', () => {
    expect(verdict(intFunction('(1 << 31) / (0 - 1)'))).toMatch(/^Godot 4\.6\.3 aborts/);
  });

  it.each([
    'vec4 f() { return vec4(1.0) * mat4(2.0); }',
    'vec4 f(vec4 a) { return mat4(2.0) * a; }',
    'vec3 f() { return mat3(2.0) * vec3(1.0); }',
  ])('reads %s', (text) => {
    expect(verdict(text)).toBe('accepted');
  });
});
