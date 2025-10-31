/**
 * Tests for Resource Parsers
 */

import { describe, it, expect } from 'vitest';
import { parseExternalResource, parseInternalResource } from './resourceParsers';
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
