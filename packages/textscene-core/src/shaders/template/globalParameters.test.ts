import { describe, expect, it } from 'vitest';
import type { FunctionNode } from '../language/shaderTree.js';
import { withGlobalParameters } from './globalParameters.js';
import { parseTemplateStage } from './parseTemplate.js';
import { preprocess } from './preprocess.js';
import type { StageName } from './stages.js';
import type { TemplateStageNode } from './templateTree.js';
import { variantLines } from './variant.js';

const NO_DEFINES = { general: '', variant: '', custom: [], hasUniforms: false, codeSections: [] };
const COLOR = { name: 'color', type: 'vec4' };

function stageOf(text: string, stage: StageName = 'fragment'): TemplateStageNode {
  const lines = text.split('\n').map((line, index) => ({ text: line, file: 't.glsl', line: index + 1 }));
  return parseTemplateStage(stage, preprocess(variantLines(lines, NO_DEFINES)));
}

function functionNamed(stage: TemplateStageNode, name: string): FunctionNode {
  return stage.declarations.find(
    (declaration): declaration is FunctionNode =>
      declaration.kind === 'function' && declaration.rname === name
  )!;
}

const parametersOf = (definition: FunctionNode) =>
  definition.arguments.map((argument) => `${argument.qualifier} ${argument.type} ${argument.name}`);

describe('withGlobalParameters', () => {
  const text = [
    'layout(location = 0) out vec4 color;',
    'float time;',
    'void shade(float scale) { color = vec4(time * scale); }',
    'void tick() { time = 2.0; }',
    'void run() { tick(); shade(0.5); }',
    'float half_of(float x) { return x * 0.5; }',
    'void main() { run(); }',
  ].join('\n');

  it('passes each global a function writes or reads to it as an inout parameter after its own', () => {
    const shade = functionNamed(withGlobalParameters(stageOf(text), COLOR), 'shade');
    expect(parametersOf(shade)).toEqual(['in float scale', 'inout vec4 color', 'inout float time']);
  });

  it('passes a global to a function that reads it only through the functions it calls', () => {
    const run = functionNamed(withGlobalParameters(stageOf(text), COLOR), 'run');
    expect(parametersOf(run)).toEqual(['inout vec4 color', 'inout float time']);
  });

  it('passes each global at each call, by its name', () => {
    const run = functionNamed(withGlobalParameters(stageOf(text), COLOR), 'run');
    const shadeCall = run.body.statements[1] as unknown as { operands: { kind: string; name?: string }[] };
    expect(shadeCall.operands.map((operand) => operand.name ?? operand.kind)).toEqual([
      'constant',
      'color',
      'time',
    ]);
  });

  it('leaves a function that touches no global, and main, as they are', () => {
    const stage = stageOf(text);
    const passed = withGlobalParameters(stage, COLOR);
    expect(functionNamed(passed, 'half_of')).toBe(functionNamed(stage, 'half_of'));
    expect(parametersOf(functionNamed(passed, 'main'))).toEqual([]);
  });

  it("passes the vertex stage's out globals and the result, a built-in", () => {
    const vertex = stageOf(
      [
        'out vec2 uv;',
        'void place() { uv = vec2(0.0); gl_Position = vec4(1.0); }',
        'void main() { place(); }',
      ].join('\n'),
      'vertex'
    );
    const place = functionNamed(withGlobalParameters(vertex, { name: 'gl_Position', type: 'vec4' }), 'place');
    expect(parametersOf(place)).toEqual(['inout vec4 gl_Position', 'inout vec2 uv']);
  });

  it('refuses a call where a local hides a global the callee needs, by its name', () => {
    const hidden = stageOf(
      [
        'float time;',
        'void tick() { time = 2.0; }',
        'void f() { float time = 1.0; tick(); }',
        'void main() { f(); }',
      ].join('\n')
    );
    expect(() => withGlobalParameters(hidden, COLOR)).toThrow('time');
  });

  it('reads a local of the name of a global as the local', () => {
    const local = stageOf(
      ['float time;', 'void f() { float time = 1.0; time = 2.0; }', 'void main() { f(); }'].join('\n')
    );
    expect(parametersOf(functionNamed(withGlobalParameters(local, COLOR), 'f'))).toEqual([]);
  });

  it("reads a local of an earlier switch label in a later label as the local, in the switch's scope", () => {
    const local = stageOf(
      [
        'float time;',
        'void f(int a) { switch (a) { case 0: float time = 1.0; case 1: time = 2.0; break; } }',
        'void main() { f(0); }',
      ].join('\n')
    );
    expect(parametersOf(functionNamed(withGlobalParameters(local, COLOR), 'f'))).toEqual(['in int a']);
  });

  it('gives each overload the globals of its own body', () => {
    const overloads = [
      'layout(location = 0) out vec4 color;',
      'float level;',
      'void f(vec2 v) { level = v.x; }',
      'void f(vec3 v) { }',
      'void main() { f(vec2(1.0)); f(vec3(1.0)); color = vec4(level); }',
    ].join('\n');
    const stage = withGlobalParameters(stageOf(overloads), COLOR);
    const [first, second] = stage.declarations.filter(
      (declaration): declaration is FunctionNode =>
        declaration.kind === 'function' && declaration.rname === 'f'
    );
    expect([parametersOf(first!), parametersOf(second!)]).toEqual([
      ['in vec2 v', 'inout float level'],
      ['in vec3 v'],
    ]);
  });
});
