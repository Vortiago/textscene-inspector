/**
 * The `SKY` kind decodes a Sky with its material to one value from every origin: the Sky and its
 * material in the scene, in a `.tres` of the Sky's own, and inside another `.tres` (ADR-0071).
 */
import { describe, expect, it } from 'vitest';
import { loadedValue } from '../reading/reading.testkit';
import type { ScopedReference } from '../reading';
import { textToVariant } from '../../godot/variant/reader/variantReader';
import { SKY } from './kind';

const MATERIAL = '[sub_resource type="ProceduralSkyMaterial" id="m"]\nsky_curve = 0.3';
const SKY_BODY = 'process_mode = 3\nsky_material = SubResource("m")';

describe('SKY of a Sky over a ProceduralSkyMaterial', () => {
  const inScene = loadedValue(
    SKY,
    'SubResource("s")',
    `${MATERIAL}\n\n[sub_resource type="Sky" id="s"]\n${SKY_BODY}\n`
  );

  it('reads the bake of a Sky in the scene', () => {
    expect(inScene).toMatchObject({ processMode: 'real-time', material: { file: 'ProceduralSkyMaterial' } });
  });

  it("hands on the material's values as its generated shader reads them", () => {
    // `inv_sky_curve` is 0.6 over `sky_curve` (`sky_material.cpp:61`).
    expect(textToVariant(inScene.material.parameters.inv_sky_curve!).value).toBeCloseTo(2, 6);
  });

  it('decodes the same value from a .tres of its own', () => {
    const files = {
      'res://sky.tres': `[gd_resource type="Sky" format=3]\n\n${MATERIAL}\n\n[resource]\n${SKY_BODY}\n`,
    };
    const scene = '[ext_resource type="Sky" path="res://sky.tres" id="1_s"]';

    expect(loadedValue(SKY, 'ExtResource("1_s")', scene, files)).toEqual(inScene);
  });

  it('decodes the same value from a sub-resource of another .tres', () => {
    const holder = `[gd_resource type="Resource" format=3]\n\n${MATERIAL}\n\n[sub_resource type="Sky" id="s"]\n${SKY_BODY}\n\n[resource]\n`;

    expect(loadedValue(SKY, 'res://holder.tres::s', '', { 'res://holder.tres': holder })).toEqual(inScene);
  });
});

describe('SKY of a Sky over a ShaderMaterial', () => {
  const SKY_SHADER = 'shader_type sky;\nuniform float tint = 0.5;\nvoid sky() {\n\tCOLOR = vec3(tint);\n}\n';
  const scene = (shaderType = 'sky') =>
    [
      `[sub_resource type="Shader" id="code"]\ncode = "${SKY_SHADER.replace('sky;', `${shaderType};`)}"`,
      '[sub_resource type="ShaderMaterial" id="m"]\nshader = SubResource("code")\nshader_parameter/tint = 0.25',
      `[sub_resource type="Sky" id="s"]\n${SKY_BODY}\n`,
    ].join('\n\n');

  it("reads the shader's code and the material's parameters", () => {
    expect(loadedValue(SKY, 'SubResource("s")', scene()).material).toEqual({
      code: SKY_SHADER,
      file: 'SubResource("code")',
      parameters: { tint: '0.25' },
      textures: {},
    });
  });

  it('hands on a parameter that names a resource as a reference, not as a value', () => {
    const withTexture = scene().replace(
      'shader_parameter/tint = 0.25',
      'shader_parameter/tint = 0.25\nshader_parameter/stars = ExtResource("1_stars")'
    );
    const tables = '[ext_resource type="Texture2D" path="res://stars.png" id="1_stars"]';
    const material = loadedValue(SKY, 'SubResource("s")', `${tables}\n\n${withTexture}`).material;
    const stars = material.textures.stars;
    expect(stars && !Array.isArray(stars) && (stars as ScopedReference).ref).toBe('ExtResource("1_stars")');
  });

  it('hands on each element of a sampler array as a reference, and null for an empty one', () => {
    const withArray = scene().replace(
      'shader_parameter/tint = 0.25',
      'shader_parameter/tint = 0.25\nshader_parameter/layers = [ExtResource("1_a"), null, ExtResource("2_b")]'
    );
    const tables = [
      '[ext_resource type="Texture2D" path="res://a.png" id="1_a"]',
      '[ext_resource type="Texture2D" path="res://b.png" id="2_b"]',
    ].join('\n');
    const material = loadedValue(SKY, 'SubResource("s")', `${tables}\n\n${withArray}`).material;
    const layers = material.textures.layers;
    expect(Array.isArray(layers) && layers.map((element) => element?.ref ?? null)).toEqual([
      'ExtResource("1_a")',
      null,
      'ExtResource("2_b")',
    ]);
  });

  it('keeps an array of values that names no resource as a value (edge case)', () => {
    const withValues = scene().replace(
      'shader_parameter/tint = 0.25',
      'shader_parameter/tint = [0.25, null]'
    );
    const material = loadedValue(SKY, 'SubResource("s")', withValues).material;
    expect(material.parameters.tint).toBe('[0.25, null]');
  });

  it("decodes the same value from a .gdshader file, with the file's path", () => {
    const files = { 'res://sky.gdshader': SKY_SHADER };
    const fromFile = [
      '[ext_resource type="Shader" path="res://sky.gdshader" id="1_code"]',
      '[sub_resource type="ShaderMaterial" id="m"]\nshader = ExtResource("1_code")\nshader_parameter/tint = 0.25',
      `[sub_resource type="Sky" id="s"]\n${SKY_BODY}\n`,
    ].join('\n\n');
    expect(loadedValue(SKY, 'SubResource("s")', fromFile, files).material).toEqual({
      ...loadedValue(SKY, 'SubResource("s")', scene()).material,
      file: 'res://sky.gdshader',
    });
  });

  it('declines a ShaderMaterial whose shader is not a sky shader', () => {
    expect(() => loadedValue(SKY, 'SubResource("s")', scene('spatial'))).toThrow('got unavailable');
  });
});
