/**
 * The `SKY` kind decodes a Sky with its material to one value from every origin: the Sky and its
 * material in the scene, in a `.tres` of the Sky's own, and inside another `.tres` (ADR-0071).
 */
import { describe, expect, it } from 'vitest';
import { loadedValue } from '../reading/reading.testkit';
import { SKY, type DecodedSky } from './kind';

const MATERIAL = '[sub_resource type="ProceduralSkyMaterial" id="m"]\nsky_curve = 0.3';
const SKY_BODY = 'process_mode = 3\nsky_material = SubResource("m")';

const summary = ({ sky, panorama }: DecodedSky) => ({ sky, panorama });

describe('SKY of a Sky over a ProceduralSkyMaterial', () => {
  const inScene = summary(
    loadedValue(SKY, 'SubResource("s")', `${MATERIAL}\n\n[sub_resource type="Sky" id="s"]\n${SKY_BODY}\n`)
  );

  it('reads the material and the bake of a Sky in the scene', () => {
    expect(inScene).toMatchObject({
      sky: { processMode: 'real-time', material: { kind: 'procedural', sky_curve: 0.3 } },
    });
  });

  it('decodes the same value from a .tres of its own', () => {
    const files = {
      'res://sky.tres': `[gd_resource type="Sky" format=3]\n\n${MATERIAL}\n\n[resource]\n${SKY_BODY}\n`,
    };
    const scene = '[ext_resource type="Sky" path="res://sky.tres" id="1_s"]';

    expect(summary(loadedValue(SKY, 'ExtResource("1_s")', scene, files))).toEqual(inScene);
  });

  it('decodes the same value from a sub-resource of another .tres', () => {
    const holder = `[gd_resource type="Resource" format=3]\n\n${MATERIAL}\n\n[sub_resource type="Sky" id="s"]\n${SKY_BODY}\n\n[resource]\n`;

    expect(summary(loadedValue(SKY, 'res://holder.tres::s', '', { 'res://holder.tres': holder }))).toEqual(
      inScene
    );
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
    expect(loadedValue(SKY, 'SubResource("s")', scene()).sky.material).toEqual({
      kind: 'shader',
      code: SKY_SHADER,
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
    const material = loadedValue(SKY, 'SubResource("s")', `${tables}\n\n${withTexture}`).sky.material;
    expect(material.kind === 'shader' && material.textures.stars?.ref).toBe('ExtResource("1_stars")');
  });

  it('decodes the same value from a .gdshader file', () => {
    const files = { 'res://sky.gdshader': SKY_SHADER };
    const fromFile = [
      '[ext_resource type="Shader" path="res://sky.gdshader" id="1_code"]',
      '[sub_resource type="ShaderMaterial" id="m"]\nshader = ExtResource("1_code")\nshader_parameter/tint = 0.25',
      `[sub_resource type="Sky" id="s"]\n${SKY_BODY}\n`,
    ].join('\n\n');
    expect(loadedValue(SKY, 'SubResource("s")', fromFile, files).sky.material).toEqual(
      loadedValue(SKY, 'SubResource("s")', scene()).sky.material
    );
  });

  it('declines a ShaderMaterial whose shader is not a sky shader', () => {
    expect(() => loadedValue(SKY, 'SubResource("s")', scene('spatial'))).toThrow('got unavailable');
  });
});
