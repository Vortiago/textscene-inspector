import { describe, expect, it } from 'vitest';
import { judge, transpilerVerdict } from './judge.mjs';

const ACCEPTED = { accepted: true };
const REFUSED = { accepted: false, message: "Invalid arguments to operator '+': 'vec2, vec3'.", line: 1 };

describe('the judge of the transpiler against Godot', () => {
  it('calls a shader both accept translated', () => {
    expect(judge(ACCEPTED, transpilerVerdict('float f(float a) { return -a; }')).state).toBe('translated');
  });

  it("calls a shader refused with Godot's message and line refused as Godot refuses", () => {
    const verdict = transpilerVerdict('vec2 f(vec2 a, vec3 b) { return a + b; }');
    expect(judge(REFUSED, verdict).state).toBe('refused as Godot refuses');
  });

  it('names the open row and its owner for a shader not translated yet', () => {
    const outcome = judge(ACCEPTED, transpilerVerdict('int f(int a) { return a; }'));
    expect(outcome).toMatchObject({ state: 'not translated yet', owner: '#1823' });
  });

  it('fails a shader the transpiler accepts and Godot refuses', () => {
    expect(judge(REFUSED, transpilerVerdict('float f(float a) { return a; }')).state).toBe('mismatch');
  });

  it('fails a shader the transpiler refuses and Godot accepts', () => {
    const verdict = transpilerVerdict('vec2 f(vec2 a, vec3 b) { return a + b; }');
    expect(judge(ACCEPTED, verdict).state).toBe('mismatch');
  });

  it('fails a refusal on another line than Godot', () => {
    const verdict = transpilerVerdict('\nvec2 f(vec2 a, vec3 b) { return a + b; }');
    expect(judge(REFUSED, verdict).state).toBe('mismatch');
  });
});
