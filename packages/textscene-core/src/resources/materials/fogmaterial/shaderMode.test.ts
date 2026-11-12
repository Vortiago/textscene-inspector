/** The SHADER_MODE kind reads the mode a Shader or a VisualShader runs in, from each origin. */

import { describe, expect, it } from 'vitest';
import { ShaderMode } from '../../../godot/rendering/shaderLanguage';
import { loadedAt, loadedValue, originsOf } from '../../reading/reading.testkit';
import { SHADER_MODE } from './shaderMode';

const FOG_CODE = 'code = "shader_type fog;\\nvoid fog() {}"';
const [inScene, ...elsewhere] = originsOf('Shader', FOG_CODE);

describe('the SHADER_MODE kind', () => {
  it('reads the mode of the code of a Shader of the scene', () => {
    expect(loadedAt(SHADER_MODE, inScene!)).toBe(ShaderMode.FOG);
  });

  it.each(elsewhere)('reads the same mode from $name', (origin) => {
    expect(loadedAt(SHADER_MODE, origin)).toBe(ShaderMode.FOG);
  });

  it('reads the mode of a .gdshader file', () => {
    const scene = '[ext_resource type="Shader" path="res://wisps.gdshader" id="1"]';
    const files = { 'res://wisps.gdshader': 'shader_type fog;\nvoid fog() {}\n' };
    expect(loadedValue(SHADER_MODE, 'ExtResource("1")', scene, files)).toBe(ShaderMode.FOG);
  });

  it('reads a Shader with no code as spatial', () => {
    const [empty] = originsOf('Shader', '');
    expect(loadedAt(SHADER_MODE, empty!)).toBe(ShaderMode.SPATIAL);
  });

  it.each([
    ['mode = 4', ShaderMode.FOG],
    ['mode = 99', ShaderMode.SPATIAL],
    ['', ShaderMode.SPATIAL],
  ])('reads a VisualShader with %j as %j', (body, mode) => {
    const [visual] = originsOf('VisualShader', body);
    expect(loadedAt(SHADER_MODE, visual!)).toBe(mode);
  });

  it('refuses a class that is no Shader', () => {
    expect(SHADER_MODE.accepts('Texture2D')).toBe(false);
  });
});
