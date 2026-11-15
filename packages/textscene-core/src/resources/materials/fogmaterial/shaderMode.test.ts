/** The SHADER_MODE kind reads the mode a Shader or a VisualShader runs in, from each origin. */

import { describe, expect, it } from 'vitest';
import { describeKindFromEveryOrigin } from '../../reading/everyOrigin.testkit';
import { ShaderMode } from '../../../godot/rendering/shaderLanguage';
import { loadedValue } from '../../reading/reading.testkit';
import { SHADER_MODE } from './shaderMode';

describeKindFromEveryOrigin([
  {
    kind: SHADER_MODE,
    className: 'Shader',
    body: 'code = "shader_type fog;\\nvoid fog() {}"',
    expected: ShaderMode.FOG,
  },
]);

describe('the SHADER_MODE kind', () => {
  it('reads the mode of a .gdshader file', () => {
    const scene = '[ext_resource type="Shader" path="res://wisps.gdshader" id="1"]';
    const files = { 'res://wisps.gdshader': 'shader_type fog;\nvoid fog() {}\n' };
    expect(loadedValue(SHADER_MODE, 'ExtResource("1")', scene, files)).toBe(ShaderMode.FOG);
  });

  it('reads a Shader with no code as spatial', () => {
    const scene = '[sub_resource type="Shader" id="r"]';
    expect(loadedValue(SHADER_MODE, 'SubResource("r")', scene)).toBe(ShaderMode.SPATIAL);
  });

  it.each([
    ['mode = 4', ShaderMode.FOG],
    ['mode = 99', ShaderMode.SPATIAL],
    ['', ShaderMode.SPATIAL],
  ])('reads a VisualShader with %j as %j', (body, mode) => {
    const scene = `[sub_resource type="VisualShader" id="r"]\n${body}`;
    expect(loadedValue(SHADER_MODE, 'SubResource("r")', scene)).toBe(mode);
  });

  it('refuses a class that is no Shader', () => {
    expect(SHADER_MODE.accepts('Texture2D')).toBe(false);
  });
});
