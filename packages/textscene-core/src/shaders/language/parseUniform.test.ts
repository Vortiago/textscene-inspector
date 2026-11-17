import { describe, expect, it } from 'vitest';
import { parse } from './parse.js';
import { tokenize } from './tokenizer.js';

const treeOf = (source: string) => parse(tokenize(source, 'user.gdshader'));
const uniformOf = (source: string) => treeOf(source).uniforms[0]!;

describe('a uniform declaration', () => {
  it('reads the type, the name and the default value', () => {
    expect(uniformOf('uniform vec2 offset = vec2(1.0, 2.0);')).toMatchObject({
      kind: 'uniform',
      name: 'offset',
      type: 'vec2',
      scope: 'local',
      hint: 'none',
      defaultValue: [1, 2],
    });
  });

  it('reads a size before the name, after it, or both, as Godot does', () => {
    expect(uniformOf('uniform float[3] a;').arraySize).toBe(3);
    expect(uniformOf('uniform float a[4];').arraySize).toBe(4);
  });

  it('converts the default to the type of the uniform', () => {
    expect(uniformOf('uniform float a = 2;').defaultValue).toEqual([2]);
  });

  it('refuses a default the type cannot take, with Godot words', () => {
    expect(() => treeOf('uniform int a = 1.5;')).toThrow("Can't convert constant to 'int'.");
  });

  it('refuses a default for an array', () => {
    expect(() => treeOf('uniform float a[2] = 1.0;')).toThrow(
      'Setting default values to uniform arrays is not supported.'
    );
  });

  it('refuses an assignment to a uniform', () => {
    expect(() => treeOf('uniform float a;\nvoid f() { a = 1.0; }')).toThrow('Assignment to uniform.');
  });

  it('refuses a function with the name of a uniform', () => {
    expect(() => treeOf('uniform float a;\nvoid a() {}')).toThrow("Redefinition of 'a'.");
  });

  it('reads the uniform in a function as a variable that names it a uniform', () => {
    const [read] = treeOf('uniform float a;\nfloat f() { return a; }').functions;
    expect(read!.body.statements[0]).toMatchObject({ expressions: [{ name: 'a', isUniform: true }] });
  });
});

describe('a uniform hint', () => {
  it('reads hint_range with its step', () => {
    expect(uniformOf('uniform float a : hint_range(-1.0, 2.0, 0.5);')).toMatchObject({
      hint: 'hint_range',
      range: [-1, 2, 0.5],
    });
  });

  it('gives hint_range a step of 1 on an int and 0.001 on a float, as Godot does', () => {
    expect(uniformOf('uniform int a : hint_range(0, 10);').range).toEqual([0, 10, 1]);
    expect(uniformOf('uniform float a : hint_range(0.0, 10.0);').range).toEqual([0, 10, Math.fround(0.001)]);
  });

  it('reads the names of hint_enum', () => {
    expect(uniformOf('uniform int a : hint_enum("x", "y");').enumNames).toEqual(['x', 'y']);
  });

  it('reads color_conversion_disabled after source_color as the hint that replaces it', () => {
    expect(uniformOf('uniform vec4 a : source_color, color_conversion_disabled;').hint).toBe(
      'color_conversion_disabled'
    );
  });

  it('refuses source_color on a float', () => {
    expect(() => treeOf('uniform float a : source_color;')).toThrow(
      "Source color hint is for 'vec3', 'vec4' or sampler types only."
    );
  });

  it('refuses a hint given twice', () => {
    expect(() => treeOf('uniform vec3 a : source_color, source_color;')).toThrow(
      "Duplicated hint: 'source_color'."
    );
  });

  it('refuses a sampler hint on a value', () => {
    expect(() => treeOf('uniform vec4 a : filter_linear;')).toThrow('This hint is only for sampler types.');
  });
});

describe('a uniform scope', () => {
  it('reads an instance uniform with its index', () => {
    expect(uniformOf('shader_type spatial;\ninstance uniform float a : instance_index(3);')).toMatchObject({
      scope: 'instance',
      instanceIndex: 3,
    });
  });

  it('reads a global uniform', () => {
    expect(uniformOf('shader_type spatial;\nglobal uniform float a;').scope).toBe('global');
  });

  it('refuses an instance uniform where the shader type has none', () => {
    expect(() => treeOf('shader_type sky;\ninstance uniform float a;')).toThrow(
      "Uniform instances are not yet implemented for 'sky' shaders."
    );
  });

  it('refuses global without uniform after it', () => {
    expect(() => treeOf('shader_type spatial;\nglobal float a;')).toThrow(
      "Expected a 'uniform' after 'global'."
    );
  });
});

describe('group_uniforms', () => {
  it('puts each uniform in the group and subgroup open before it', () => {
    const { uniforms } = treeOf('group_uniforms g.s;\nuniform float a;\ngroup_uniforms;\nuniform float b;');
    expect(uniforms.map(({ group, subgroup }) => [group, subgroup])).toEqual([
      ['g', 's'],
      ['', ''],
    ]);
  });

  it('refuses a group with no name', () => {
    expect(() => treeOf('group_uniforms 1;')).toThrow('Expected an uniform group identifier.');
  });

  it('refuses a group closed before one is open', () => {
    expect(() => treeOf('group_uniforms;')).toThrow('Group needs to be opened before.');
  });
});
