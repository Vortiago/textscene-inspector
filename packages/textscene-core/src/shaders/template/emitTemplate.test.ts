import { screenCoordinate, uv, vec2 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { generatedFragmentShader } from '../generatedShader.testkit';
import { parse } from '../language/parse.js';
import { tokenize } from '../language/tokenizer.js';
import { emitTemplateStage } from './emitTemplate.js';
import { compileMaterial, linkTemplateStage } from './link.js';
import { MODE_TABLES } from './modeTables.generated.js';
import { DEFAULT_SKY } from '../sky/defaultSky.testkit';

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
});
