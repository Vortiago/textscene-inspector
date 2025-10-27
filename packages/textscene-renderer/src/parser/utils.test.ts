/**
 * Tests for parser utilities
 *
 * These are foundational utilities used throughout the parser
 */

import { describe, it, expect } from 'vitest';
import { parseHeading, parseProperty, isHeading, isComment, isEmpty } from './utils';

describe('parseHeading', () => {
  it('should parse simple heading without attributes', () => {
    const result = parseHeading('[gd_scene]');

    expect(result).not.toBeNull();
    expect(result!.type).toBe('gd_scene');
    expect(result!.attributes).toEqual({});
  });

  it('should parse heading with single attribute', () => {
    const result = parseHeading('[node name="Root"]');

    expect(result).not.toBeNull();
    expect(result!.type).toBe('node');
    expect(result!.attributes).toEqual({ name: 'Root' });
  });

  it('should parse heading with multiple attributes', () => {
    const result = parseHeading('[node name="Child" type="Node3D" parent="."]');

    expect(result).not.toBeNull();
    expect(result!.type).toBe('node');
    expect(result!.attributes).toEqual({
      name: 'Child',
      type: 'Node3D',
      parent: '.',
    });
  });

  it('should parse heading with quoted values containing spaces', () => {
    const result = parseHeading('[ext_resource type="PackedScene" path="res://my scene.tscn"]');

    expect(result).not.toBeNull();
    expect(result!.attributes.path).toBe('res://my scene.tscn');
  });

  it('should handle escaped quotes in values', () => {
    const result = parseHeading('[node name="Node with \\"quotes\\""]');

    expect(result).not.toBeNull();
    expect(result!.attributes.name).toBe('Node with "quotes"');
  });

  it('should parse heading with unquoted values', () => {
    const result = parseHeading('[gd_scene format=3]');

    expect(result).not.toBeNull();
    expect(result!.attributes.format).toBe('3');
  });

  it('should parse heading with mixed quoted and unquoted values', () => {
    const result = parseHeading('[gd_scene load_steps=77 format=3 uid="uid://abc123"]');

    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({
      load_steps: '77',
      format: '3',
      uid: 'uid://abc123',
    });
  });

  it('should handle heading with special characters in values', () => {
    const result = parseHeading('[ext_resource path="res://path/to/file.tscn" id="1_abc123"]');

    expect(result).not.toBeNull();
    expect(result!.attributes.path).toBe('res://path/to/file.tscn');
    expect(result!.attributes.id).toBe('1_abc123');
  });

  it('should handle heading with colons in values', () => {
    const result = parseHeading('[node instance=ExtResource("1_abc")]');

    expect(result).not.toBeNull();
    expect(result!.attributes.instance).toBe('ExtResource("1_abc")');
  });

  it('should return null for non-heading lines', () => {
    expect(parseHeading('not a heading')).toBeNull();
    expect(parseHeading('transform = Vector3(1, 2, 3)')).toBeNull();
    expect(parseHeading('')).toBeNull();
  });

  it('should return null for malformed headings', () => {
    expect(parseHeading('[incomplete')).toBeNull();
    expect(parseHeading('incomplete]')).toBeNull();
  });

  it('should handle headings with extra whitespace', () => {
    const result = parseHeading('  [ node   name="Root"   type="Node3D"  ]  ');

    expect(result).not.toBeNull();
    expect(result!.type).toBe('node');
    expect(result!.attributes.name).toBe('Root');
  });

  it('should handle empty attribute list', () => {
    const result = parseHeading('[editable path="Test"]');

    expect(result).not.toBeNull();
    expect(result!.type).toBe('editable');
  });
});

describe('parseProperty', () => {
  it('should parse simple property', () => {
    const result = parseProperty('position = Vector3(1, 2, 3)');

    expect(result).not.toBeNull();
    expect(result!.key).toBe('position');
    expect(result!.value).toBe('Vector3(1, 2, 3)');
  });

  it('should parse property with transform', () => {
    const result = parseProperty('transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)');

    expect(result).not.toBeNull();
    expect(result!.key).toBe('transform');
    expect(result!.value).toBe('Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)');
  });

  it('should handle properties with extra whitespace', () => {
    const result = parseProperty('  scale  =  Vector3(2, 2, 2)  ');

    expect(result).not.toBeNull();
    expect(result!.key).toBe('scale');
    expect(result!.value).toBe('Vector3(2, 2, 2)');
  });

  it('should handle properties with = in value', () => {
    const result = parseProperty('expression = "a = b + c"');

    expect(result).not.toBeNull();
    expect(result!.key).toBe('expression');
    expect(result!.value).toBe('"a = b + c"');
  });

  it('should handle string properties', () => {
    const result = parseProperty('script = ExtResource("1_abc")');

    expect(result).not.toBeNull();
    expect(result!.key).toBe('script');
    expect(result!.value).toBe('ExtResource("1_abc")');
  });

  it('should handle numeric properties', () => {
    const result = parseProperty('size = 42');

    expect(result).not.toBeNull();
    expect(result!.key).toBe('size');
    expect(result!.value).toBe('42');
  });

  it('should handle boolean properties', () => {
    const result = parseProperty('visible = true');

    expect(result).not.toBeNull();
    expect(result!.key).toBe('visible');
    expect(result!.value).toBe('true');
  });

  it('should return null for empty lines', () => {
    expect(parseProperty('')).toBeNull();
    expect(parseProperty('   ')).toBeNull();
  });

  it('should return null for comment lines', () => {
    expect(parseProperty('; This is a comment')).toBeNull();
  });

  it('should return null for lines without =', () => {
    expect(parseProperty('not a property')).toBeNull();
    expect(parseProperty('just some text')).toBeNull();
  });

  it('should handle properties with underscores', () => {
    const result = parseProperty('my_property = value');

    expect(result).not.toBeNull();
    expect(result!.key).toBe('my_property');
  });

  it('should handle properties with numbers in key', () => {
    const result = parseProperty('property2 = value');

    expect(result).not.toBeNull();
    expect(result!.key).toBe('property2');
  });
});

describe('isHeading', () => {
  it('should identify valid headings', () => {
    expect(isHeading('[gd_scene]')).toBe(true);
    expect(isHeading('[node name="Test"]')).toBe(true);
    expect(isHeading('  [ext_resource]  ')).toBe(true);
  });

  it('should reject non-headings', () => {
    expect(isHeading('transform = Vector3(1, 2, 3)')).toBe(false);
    expect(isHeading('not a heading')).toBe(false);
    expect(isHeading('')).toBe(false);
  });

  it('should reject malformed headings', () => {
    expect(isHeading('[incomplete')).toBe(false);
    expect(isHeading('incomplete]')).toBe(false);
  });

  it('should handle whitespace', () => {
    expect(isHeading('   [node]   ')).toBe(true);
  });
});

describe('isComment', () => {
  it('should identify comments', () => {
    expect(isComment('; This is a comment')).toBe(true);
    expect(isComment(';Another comment')).toBe(true);
  });

  it('should handle whitespace before semicolon', () => {
    expect(isComment('  ; Indented comment')).toBe(true);
  });

  it('should reject non-comments', () => {
    expect(isComment('[node]')).toBe(false);
    expect(isComment('transform = Vector3(1, 2, 3)')).toBe(false);
    expect(isComment('Not a comment')).toBe(false);
    expect(isComment('')).toBe(false);
  });
});

describe('isEmpty', () => {
  it('should identify empty lines', () => {
    expect(isEmpty('')).toBe(true);
    expect(isEmpty('   ')).toBe(true);
    expect(isEmpty('\t')).toBe(true);
    expect(isEmpty('  \t  ')).toBe(true);
  });

  it('should reject non-empty lines', () => {
    expect(isEmpty('[node]')).toBe(false);
    expect(isEmpty('; comment')).toBe(false);
    expect(isEmpty('a')).toBe(false);
    expect(isEmpty('  a  ')).toBe(false);
  });
});
