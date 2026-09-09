/**
 * Tests for StrictTscnParser: what a well-formed file yields — the sections,
 * their types, and the properties read off each one.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StrictTscnParser } from './StrictTscnParser.js';
import '../linter/index.js'; // trigger all validator registrations

describe('StrictTscnParser', () => {
  let parser: StrictTscnParser;

  beforeEach(() => {
    parser = new StrictTscnParser();
  });

  describe('Valid TSCN Parsing', () => {
    it('should parse a minimal valid TSCN file', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      expect(result.scene!.nodes).toHaveLength(1);
      expect(result.scene!.nodes[0]!.name).toBe('Root');
      expect(result.scene!.nodes[0]!.type).toBe('Node3D');
    });

    it('should parse TSCN with multiple nodes', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="Child" type="MeshInstance3D" parent="."]

[node name="GrandChild" type="Camera3D" parent="Child"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      expect(result.scene!.nodes).toHaveLength(1);
      expect(result.scene!.nodes[0]!.children).toHaveLength(1);
      expect(result.scene!.nodes[0]!.children[0]!.children).toHaveLength(1);
    });

    it('should parse TSCN with external resources', () => {
      const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://enemy.tscn" id="1_abc"]

[node name="Root" type="Node3D"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      expect(result.scene!.externalResources).toHaveLength(1);
      expect(result.scene!.externalResources[0]!.path).toBe('res://enemy.tscn');
      expect(result.scene!.externalResources[0]!.type).toBe('PackedScene');
    });

    it('should parse TSCN with internal resources', () => {
      const content = `[gd_scene load_steps=2 format=3]

[sub_resource type="BoxMesh" id="BoxMesh_1"]

[node name="Root" type="Node3D"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      expect(result.scene!.internalResources).toHaveLength(1);
      expect(result.scene!.internalResources[0]!.type).toBe('BoxMesh');
      expect(result.scene!.internalResources[0]!.id).toBe('BoxMesh_1');
    });

    it('should parse node with properties', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
visible = true
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      expect(result.scene!.nodes[0]!.properties).toHaveProperty('transform');
      expect(result.scene!.nodes[0]!.properties).toHaveProperty('visible');
    });

    it('should skip empty lines and comments', () => {
      const content = `[gd_scene load_steps=1 format=3]

; This is a comment

[node name="Root" type="Node3D"]

; Another comment
visible = true
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
    });
  });

  describe('Section Type Identification', () => {
    it('should identify gd_scene heading', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
    });

    it('should identify node sections', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
[node name="Child" type="Node3D" parent="."]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene!.nodes[0]!.children).toHaveLength(1);
    });

    it('should identify ext_resource sections', () => {
      const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://icon.png" id="1"]

[node name="Root" type="Node3D"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene!.externalResources).toHaveLength(1);
    });

    it('should identify sub_resource sections', () => {
      const content = `[gd_scene load_steps=2 format=3]

[sub_resource type="BoxMesh" id="1"]

[node name="Root" type="Node3D"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene!.internalResources).toHaveLength(1);
    });
  });

  describe('a rewritten nil diagnostic', () => {
    it('anchors on the value, exactly where the validator put it', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Panel" type="Control"]
texture_filter = null
`;

      const result = parser.parse(content);

      const nil = result.errors.find((e) => e.message.includes('cannot hold'));
      expect(nil).toBeDefined();
      // Same anchor as every other property diagnostic: just past `key = `.
      expect(nil!.column).toBe('texture_filter'.length + 3);
      expect(nil!.line).toBe(4);
    });

    it('reports at the CONVERSION tier, which ADR-0032 puts at warning', () => {
      // The binding narrows the null before the setter runs, so the setter never
      // refuses anything and the file loads — the same tier `hframes = 5.5`
      // gets. Reporting it as an error failed `lint:scenes` on a scene Godot
      // opens without complaint.
      const content = `[gd_scene load_steps=1 format=3]

[node name="Panel" type="Control"]
texture_filter = null
visible = null
`;

      const nils = parser.parse(content).errors.filter((e) => e.message.includes('cannot hold'));
      expect(nils).toHaveLength(2);
      expect(nils.map((e) => e.severity)).toEqual(['warning', 'warning']);
    });

    // A key-shape refusal describes a key the class does not have, so "this
    // slot stores the type's zero instead" names a slot that does not exist.
    // The flag sits on the ERROR: a family dispatcher's LEAF branches really do
    // read a value, and the registry hands the seam the dispatcher, so only the
    // branch that refused can say which kind of verdict it made.
    describe('leaves a key-shape refusal alone', () => {
      const parseOne = (type: string, key: string, value: string) =>
        parser.parse(
          `[gd_scene load_steps=1 format=3]\n\n[node name="Root" type="Node3D"]\n\n` +
            `[node name="N" type="${type}" parent="."]\n${key} = ${value}\n`
        ).errors;

      it('keeps the unknown-key error on a glued-index family', () => {
        const [written] = parseOne('ItemList', 'item_0/bogus', '"x"');
        const [asNil] = parseOne('ItemList', 'item_0/bogus', 'null');
        expect(written!.message).toMatch(/^Unknown item_/);
        expect(asNil!.message).toBe(written!.message);
        expect(asNil!.severity).toBe('error');
      });

      it('keeps the unknown-key error on a hand-rolled nested family', () => {
        const [written] = parseOne('SpringBoneSimulator3D', 'settings/0/joints/0/bogus', '"x"');
        const [asNil] = parseOne('SpringBoneSimulator3D', 'settings/0/joints/0/bogus', 'null');
        expect(written!.message).toContain('Unknown SpringBoneSimulator3D joint property');
        expect(asNil!.message).toBe(written!.message);
        expect(asNil!.severity).toBe('error');
      });

      it('keeps the negative-index refusal', () => {
        const [written] = parseOne('FileDialog', 'option_-1/name', '"x"');
        const [asNil] = parseOne('FileDialog', 'option_-1/name', 'null');
        expect(written!.message).toContain('must be non-negative');
        expect(asNil!.message).toBe(written!.message);
        expect(asNil!.severity).toBe('error');
      });
    });
  });
});
