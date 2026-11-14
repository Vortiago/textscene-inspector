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
  const text = `${globals}\nlayout(location = 0) out vec4 color;\nvoid main() {\n${body}\n}`;
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

  it.each(['texture2DArray', 'textureCube'])('refuses a %s it has no node for, by its name', (type) => {
    expect(() => fragmentOf(`uniform ${type} layers;`, 'color = vec4(1.0);')).toThrow(`${type} layers`);
  });
});
