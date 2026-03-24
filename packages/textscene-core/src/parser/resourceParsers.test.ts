/**
 * Tests for Resource Parsers
 */

import { describe, it, expect } from 'vitest';
import { parseExternalResource, parseInternalResource, parseResourceFile } from './resourceParsers';
import type { ParsedHeading } from './utils';

describe('parseExternalResource', () => {
  it('should parse external resource with all attributes', () => {
    const heading: ParsedHeading = {
      type: 'ext_resource',
      attributes: {
        id: '1_abc',
        path: 'res://textures/test.png',
        type: 'Texture2D',
      },
    };

    const result = parseExternalResource(heading);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('1_abc');
    expect(result!.path).toBe('res://textures/test.png');
    expect(result!.type).toBe('Texture2D');
  });

  it('should return null for null heading', () => {
    const result = parseExternalResource(null);
    expect(result).toBeNull();
  });

  it('should handle missing path attribute', () => {
    const heading: ParsedHeading = {
      type: 'ext_resource',
      attributes: {
        id: '1_abc',
        type: 'Texture2D',
      },
    };

    const result = parseExternalResource(heading);

    expect(result).not.toBeNull();
    expect(result!.path).toBe('');
    expect(result!.type).toBe('Texture2D');
  });

  it('should handle missing type attribute', () => {
    const heading: ParsedHeading = {
      type: 'ext_resource',
      attributes: {
        id: '1_abc',
        path: 'res://test.tscn',
      },
    };

    const result = parseExternalResource(heading);

    expect(result).not.toBeNull();
    expect(result!.path).toBe('res://test.tscn');
    expect(result!.type).toBe('');
  });

  it('should handle empty attributes', () => {
    const heading: ParsedHeading = {
      type: 'ext_resource',
      attributes: {},
    };

    const result = parseExternalResource(heading);

    expect(result).not.toBeNull();
    expect(result!.path).toBe('');
    expect(result!.type).toBe('');
    expect(result!.id).toBe('');
  });

  it('should parse PackedScene resource', () => {
    const heading: ParsedHeading = {
      type: 'ext_resource',
      attributes: {
        id: '2_xyz',
        path: 'res://scenes/level.tscn',
        type: 'PackedScene',
      },
    };

    const result = parseExternalResource(heading);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('PackedScene');
    expect(result!.path).toBe('res://scenes/level.tscn');
  });

  it('should parse Script resource', () => {
    const heading: ParsedHeading = {
      type: 'ext_resource',
      attributes: {
        id: '3_ghi',
        path: 'res://scripts/player.gd',
        type: 'Script',
      },
    };

    const result = parseExternalResource(heading);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('Script');
    expect(result!.path).toBe('res://scripts/player.gd');
  });
});

describe('parseInternalResource', () => {
  it('should parse internal resource with properties', () => {
    const heading: ParsedHeading = {
      type: 'sub_resource',
      attributes: {
        id: 'BoxMesh_1',
        type: 'BoxMesh',
      },
    };

    const properties = {
      size: 'Vector3(1, 1, 1)',
      material: 'SubResource("Material_1")',
    };

    const result = parseInternalResource(heading, properties);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('BoxMesh');
    expect(result!.data).toEqual({ ...properties, id: 'BoxMesh_1' });
    expect(result!.data.size).toBe('Vector3(1, 1, 1)');
  });

  it('should return null for null heading', () => {
    const result = parseInternalResource(null, {});
    expect(result).toBeNull();
  });

  it('should handle empty properties', () => {
    const heading: ParsedHeading = {
      type: 'sub_resource',
      attributes: {
        id: 'Material_1',
        type: 'StandardMaterial3D',
      },
    };

    const result = parseInternalResource(heading, {});

    expect(result).not.toBeNull();
    expect(result!.type).toBe('StandardMaterial3D');
    expect(result!.data).toEqual({ id: 'Material_1' });
  });

  it('should handle missing type attribute', () => {
    const heading: ParsedHeading = {
      type: 'sub_resource',
      attributes: {
        id: 'Resource_1',
      },
    };

    const properties = { value: '42' };

    const result = parseInternalResource(heading, properties);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('');
    expect(result!.data).toEqual({ ...properties, id: 'Resource_1' });
  });

  it('should parse BoxMesh resource', () => {
    const heading: ParsedHeading = {
      type: 'sub_resource',
      attributes: {
        id: 'BoxMesh_2',
        type: 'BoxMesh',
      },
    };

    const properties = {
      size: 'Vector3(2, 3, 4)',
    };

    const result = parseInternalResource(heading, properties);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('BoxMesh');
    expect(result!.data.size).toBe('Vector3(2, 3, 4)');
  });

  it('should parse StandardMaterial3D resource', () => {
    const heading: ParsedHeading = {
      type: 'sub_resource',
      attributes: {
        id: 'Material_3',
        type: 'StandardMaterial3D',
      },
    };

    const properties = {
      albedo_color: 'Color(1, 0, 0, 1)',
      metallic: '0.5',
      roughness: '0.8',
    };

    const result = parseInternalResource(heading, properties);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('StandardMaterial3D');
    expect(result!.data.albedo_color).toBe('Color(1, 0, 0, 1)');
    expect(result!.data.metallic).toBe('0.5');
    expect(result!.data.roughness).toBe('0.8');
  });

  it('should preserve all properties in data', () => {
    const heading: ParsedHeading = {
      type: 'sub_resource',
      attributes: {
        id: 'ComplexResource_1',
        type: 'ComplexType',
      },
    };

    const properties = {
      prop1: 'value1',
      prop2: 'value2',
      prop3: 'value3',
      nested: 'SubResource("Other")',
    };

    const result = parseInternalResource(heading, properties);

    expect(result).not.toBeNull();
    expect(result!.data).toEqual({ ...properties, id: 'ComplexResource_1' });
    expect(Object.keys(result!.data)).toHaveLength(5);
  });

  it('should handle special characters in properties', () => {
    const heading: ParsedHeading = {
      type: 'sub_resource',
      attributes: {
        id: 'Resource_1',
        type: 'TestResource',
      },
    };

    const properties = {
      text: 'Hello "World"',
      path: 'res://path/to/file.png',
      vector: 'Vector3(1.5, 2.3, -4.8)',
    };

    const result = parseInternalResource(heading, properties);

    expect(result).not.toBeNull();
    expect(result!.data.text).toBe('Hello "World"');
    expect(result!.data.path).toBe('res://path/to/file.png');
    expect(result!.data.vector).toBe('Vector3(1.5, 2.3, -4.8)');
  });
});

describe('parseResourceFile', () => {
  it('should parse StandardMaterial3D .tres file', () => {
    const content = `
[gd_resource type="StandardMaterial3D" format=3]

[resource]
albedo_color = Color(0.8, 0.2, 0.2, 1)
metallic = 0.7
roughness = 0.3
    `;

    const { type, properties } = parseResourceFile(content);

    expect(type).toBe('StandardMaterial3D');
    expect(properties.albedo_color).toBe('Color(0.8, 0.2, 0.2, 1)');
    expect(properties.metallic).toBe(0.7);
    expect(properties.roughness).toBe(0.3);
  });

  it('should handle empty resource section', () => {
    const content = `
[gd_resource type="StandardMaterial3D" format=3]

[resource]
    `;

    const { type, properties } = parseResourceFile(content);

    expect(type).toBe('StandardMaterial3D');
    expect(Object.keys(properties)).toHaveLength(0);
  });

  it('should throw on invalid format without gd_resource header', () => {
    const content = 'invalid content';

    expect(() => parseResourceFile(content)).toThrow('Invalid .tres file: missing [gd_resource] header');
  });

  it('should throw on missing type attribute', () => {
    const content = `
[gd_resource format=3]

[resource]
    `;

    expect(() => parseResourceFile(content)).toThrow('Invalid .tres file: missing type attribute');
  });

  it('should throw on missing resource section', () => {
    const content = `
[gd_resource type="StandardMaterial3D" format=3]
    `;

    expect(() => parseResourceFile(content)).toThrow('Invalid .tres file: missing [resource] section');
  });

  it('should parse boolean values', () => {
    const content = `
[gd_resource type="StandardMaterial3D" format=3]

[resource]
emission_enabled = true
transparency_enabled = false
    `;

    const { properties } = parseResourceFile(content);

    expect(properties.emission_enabled).toBe(true);
    expect(properties.transparency_enabled).toBe(false);
  });

  it('should parse numeric values', () => {
    const content = `
[gd_resource type="StandardMaterial3D" format=3]

[resource]
metallic = 0.5
roughness = 0.8
emission_energy = 2.5
    `;

    const { properties } = parseResourceFile(content);

    expect(properties.metallic).toBe(0.5);
    expect(properties.roughness).toBe(0.8);
    expect(properties.emission_energy).toBe(2.5);
  });

  it('should parse string values with quotes', () => {
    const content = `
[gd_resource type="StandardMaterial3D" format=3]

[resource]
name = "My Material"
path = "res://materials/test.tres"
    `;

    const { properties } = parseResourceFile(content);

    expect(properties.name).toBe('My Material');
    expect(properties.path).toBe('res://materials/test.tres');
  });

  it('should parse Vector3 values', () => {
    const content = `
[gd_resource type="StandardMaterial3D" format=3]

[resource]
uv1_scale = Vector3(2, 2, 2)
uv1_offset = Vector3(0.5, 0.5, 0)
    `;

    const { properties } = parseResourceFile(content);

    expect(properties.uv1_scale).toBe('Vector3(2, 2, 2)');
    expect(properties.uv1_offset).toBe('Vector3(0.5, 0.5, 0)');
  });

  it('should preserve ExtResource references as strings', () => {
    const content = `
[gd_resource type="StandardMaterial3D" format=3]

[resource]
albedo_texture = ExtResource("1_abc")
normal_texture = ExtResource("2_xyz")
    `;

    const { properties } = parseResourceFile(content);

    expect(properties.albedo_texture).toBe('ExtResource("1_abc")');
    expect(properties.normal_texture).toBe('ExtResource("2_xyz")');
  });

  it('should preserve SubResource references as strings', () => {
    const content = `
[gd_resource type="StandardMaterial3D" format=3]

[resource]
next_pass = SubResource("1")
    `;

    const { properties } = parseResourceFile(content);

    expect(properties.next_pass).toBe('SubResource("1")');
  });

  it('should skip empty lines and comments', () => {
    const content = `
[gd_resource type="StandardMaterial3D" format=3]

[resource]
; This is a comment
metallic = 0.5

; Another comment
roughness = 0.3
    `;

    const { properties } = parseResourceFile(content);

    expect(properties.metallic).toBe(0.5);
    expect(properties.roughness).toBe(0.3);
    expect(Object.keys(properties)).toHaveLength(2);
  });

  it('should handle complex material with multiple property types', () => {
    const content = `
[gd_resource type="StandardMaterial3D" format=3]

[resource]
albedo_color = Color(0.7, 0.7, 0.75, 1)
metallic = 0.9
roughness = 0.2
emission_enabled = true
emission = Color(1, 0.5, 0, 1)
emission_energy_multiplier = 2.0
uv1_scale = Vector3(1, 1, 1)
    `;

    const { type, properties } = parseResourceFile(content);

    expect(type).toBe('StandardMaterial3D');
    expect(properties.albedo_color).toBe('Color(0.7, 0.7, 0.75, 1)');
    expect(properties.metallic).toBe(0.9);
    expect(properties.roughness).toBe(0.2);
    expect(properties.emission_enabled).toBe(true);
    expect(properties.emission).toBe('Color(1, 0.5, 0, 1)');
    expect(properties.emission_energy_multiplier).toBe(2.0);
    expect(properties.uv1_scale).toBe('Vector3(1, 1, 1)');
  });
});
