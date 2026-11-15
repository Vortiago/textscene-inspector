/** The FOG_VOLUME_MATERIAL kind reads what fills a FogVolume the same from each origin. */

import { describe, expect, it } from 'vitest';
import { snapshotOver } from '../../reading/snapshot';
import { nodeReference } from '../../reading/scopedReference';
import { describeKindFromEveryOrigin } from '../../reading/everyOrigin.testkit';
import { loadedValue, sceneTables } from '../../reading/reading.testkit';
import { FOG_VOLUME_MATERIAL } from './kind';

describeKindFromEveryOrigin([
  {
    kind: FOG_VOLUME_MATERIAL,
    className: 'FogMaterial',
    body: 'density = -2.0',
    expected: 'material with density -2',
    summarise: (value) => value.kind === 'material' && `material with density ${value.material.density}`,
  },
]);

const SHADER_MATERIAL = `[gd_resource type="ShaderMaterial" format=3]

[ext_resource type="Shader" path="res://fog.gdshader" id="1"]

[resource]
shader = ExtResource("1")
`;

describe('the FOG_VOLUME_MATERIAL kind', () => {
  it('hands on the density texture with the tables of the FogMaterial', () => {
    const value = loadedValue(FOG_VOLUME_MATERIAL, 'res://holder.tres::m', '', {
      'res://holder.tres':
        '[gd_resource type="Resource" format=3]\n\n[sub_resource type="FogMaterial" id="m"]\ndensity_texture = ExtResource("9_d")\n\n[resource]\n',
    });
    expect(value).toMatchObject({ kind: 'material', densityTexture: { ref: 'ExtResource("9_d")' } });
  });

  it('follows the shader of a ShaderMaterial .tres in the tables of that file', () => {
    // The scene writes id "1" for a spatial shader: the material file's own "1" is the fog shader.
    const scene = `[ext_resource type="Shader" path="res://spatial.gdshader" id="1"]
[ext_resource type="Material" path="res://fog.tres" id="2"]`;
    const files = {
      'res://fog.tres': SHADER_MATERIAL,
      'res://fog.gdshader': 'shader_type fog;\n',
      'res://spatial.gdshader': 'shader_type spatial;\n',
    };
    expect(loadedValue(FOG_VOLUME_MATERIAL, 'ExtResource("2")', scene, files)).toEqual({
      kind: 'shader',
      shader: 'ExtResource("1")',
    });
  });

  it("fills a ShaderMaterial whose shader is not a fog shader with Godot's default fog", () => {
    const files = { 'res://fog.tres': SHADER_MATERIAL, 'res://fog.gdshader': 'shader_type spatial;\n' };
    const scene = '[ext_resource type="Material" path="res://fog.tres" id="2"]';
    expect(loadedValue(FOG_VOLUME_MATERIAL, 'ExtResource("2")', scene, files)).toEqual({ kind: 'default' });
  });

  it('is pending while the shader loads', () => {
    const scene = sceneTables(`[ext_resource type="Shader" path="res://fog.gdshader" id="1"]
[sub_resource type="ShaderMaterial" id="m"]
shader = ExtResource("1")`);
    const read = snapshotOver({ getCached: () => undefined }).read(
      nodeReference('SubResource("m")', scene),
      FOG_VOLUME_MATERIAL
    );
    expect(read.status).toBe('pending');
  });

  it("fills a ShaderMaterial whose shader fails to load with Godot's default fog", () => {
    const scene = `[ext_resource type="Shader" path="res://gone.gdshader" id="1"]
[sub_resource type="ShaderMaterial" id="m"]
shader = ExtResource("1")`;
    expect(loadedValue(FOG_VOLUME_MATERIAL, 'SubResource("m")', scene)).toEqual({ kind: 'default' });
  });

  it('refuses a material that Godot also fills with its default fog', () => {
    expect(FOG_VOLUME_MATERIAL.accepts('StandardMaterial3D')).toBe(false);
  });
});
