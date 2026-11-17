import { screenCoordinate, uv, vec2 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { generatedFragmentShader } from '../generatedShader.testkit';
import { parse } from '../language/parse.js';
import { tokenize } from '../language/tokenizer.js';
import { emitTemplateStage } from './emitTemplate.js';
import { compileMaterial, linkTemplateStage } from './link.js';
import { MODE_TABLES } from './modeTables.generated.js';
import { parseTemplateStage } from './parseTemplate.js';
import { preprocess } from './preprocess.js';
import { variantLines } from './variant.js';
import { DEFAULT_SKY } from '../sky/defaultSky.testkit';

const NO_DEFINES = { general: '', variant: '', custom: [], hasUniforms: false, codeSections: [] };

/** The fragment GLSL of a template stage whose `main` is `body` and leaves its result in `color`. */
function fragmentOf(globals: string, body: string): string {
  const text = `layout(location = 0) out vec4 color;\n${globals}\nvoid main() {\n${body}\n}`;
  const lines = text.split('\n').map((line, index) => ({ text: line, file: 't.glsl', line: index + 1 }));
  const stage = parseTemplateStage('fragment', preprocess(variantLines(lines, NO_DEFINES)));
  const { result } = emitTemplateStage(stage, new Map(), { name: 'color', type: 'vec4' });
  return generatedFragmentShader(result);
}

function skyFragment() {
  const material = compileMaterial(parse(tokenize(DEFAULT_SKY, 'user.gdshader')), MODE_TABLES.sky!);
  const stage = linkTemplateStage('environment/sky.glsl', 'fragment', '', material);
  const inputs = new Map<string, Node>([
    ['uv_interp', vec2(uv()) as unknown as Node],
    ['gl_FragCoord', screenCoordinate as unknown as Node],
  ]);
  return emitTemplateStage(stage, inputs, { name: 'frag_color', type: 'vec4' });
}

describe('emitTemplateStage', () => {
  it("builds the sky's fragment stage as one program", () => {
    expect(generatedFragmentShader(skyFragment().result)).toContain('pow(');
  });

  it('gives each member of a uniform block a uniform by its name', () => {
    expect(skyFragment().uniforms.has('params.time')).toBe(true);
  });

  it('gives each member of an array of structs an array', () => {
    expect(skyFragment().uniforms.has('directional_lights.data.direction_energy')).toBe(true);
  });

  it('gives each texture a node to bind', () => {
    expect([...skyFragment().textures.keys()]).toContain('volumetric_fog_texture');
  });

  it('gives a const global its folded value', () => {
    expect(fragmentOf('const float HALF = 1.0 / 2.0;', 'color = vec4(HALF);')).toMatch(/vec4\(\s*0\.5\s*\)/);
  });

  it('writes a call of a built-in that stands as a statement', () => {
    expect(fragmentOf('', 'color = vec4(1.0);\nmax(1.0, 2.0);')).toContain('vec4( 1.0, 1.0, 1.0, 1.0 )');
  });

  it.each(['textureCubeArray', 'utexture2D'])('refuses a %s it has no node for, by its name', (type) => {
    expect(() => fragmentOf(`uniform ${type} layers;`, 'color = vec4(1.0);')).toThrow(`${type} layers`);
  });

  it('holds a global that a function writes in main, and passes it to the function', () => {
    const text = fragmentOf('float level;\nvoid raise() { level = 0.25; }', 'raise();\ncolor = vec4(level);');
    expect(text).toMatch(/inout float|0\.25/);
    expect(text).toMatch(/fragColor = /);
  });

  it('writes the result from a function main calls', () => {
    const globals = 'void shade() { color = vec4(0.75); }';
    expect(fragmentOf(globals, 'shade();')).toContain('0.75');
  });

  it('names a function of leading or doubled underscores with no two underscores in a row', () => {
    const text = fragmentOf('vec4 _half__of(vec4 x) { return x * 0.5; }', 'color = _half__of(vec4(1.0));');
    expect(text).toContain('half_of');
    expect(text).not.toMatch(/\w__\w/);
  });

  it('gives each texture of an array of textures its own node, by its index', () => {
    const globals = 'uniform texture2D maps[2];\nuniform sampler s;';
    const text = fragmentOf(globals, 'color = texture(sampler2D(maps[1], s), vec2(0.5));');
    expect(text.match(/uniform sampler2D/g)).toHaveLength(1);
  });
});

describe('emitTemplateStage on a subgroup of one lane', () => {
  it.each([
    ['subgroupBroadcastFirst(0.25)', 'vec4( 0.25'],
    ['subgroupMax(0.25)', 'vec4( 0.25'],
    ['subgroupMin(0.25)', 'vec4( 0.25'],
    ['subgroupAdd(0.25)', 'vec4( 0.25'],
    ['float(subgroupOr(3u))', '3u'],
  ])('reads %s as its operand', (call, operand) => {
    const text = fragmentOf('', `color = vec4(${call});`);
    expect(text).toContain(operand);
    expect(text).not.toContain('subgroup');
  });

  it('reads a ballot as the lane bit of its own invocation only', () => {
    const body = 'uvec4 ballot = subgroupBallot(true);\ncolor = vec4(float(subgroupBallotBitCount(ballot)));';
    const text = fragmentOf('', body);
    expect(text).toMatch(/uvec4\( \w+, 0u, 0u, 0u \)/);
    expect(text).toMatch(/\.x & 1u/);
    expect(text).not.toContain('subgroup');
  });

  it('elects the one invocation, and votes with its own value', () => {
    const body = 'color = vec4(subgroupElect() && subgroupAll(true) && subgroupAny(true) ? 1.0 : 0.0);';
    expect(fragmentOf('', body)).not.toContain('subgroup');
  });
});
