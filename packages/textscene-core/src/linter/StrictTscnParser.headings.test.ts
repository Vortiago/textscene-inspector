/**
 * StrictTscnParser: headings the scanner cannot read at all: malformed
 * brackets, quoting and attribute syntax.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StrictTscnParser } from './StrictTscnParser.js';

describe('StrictTscnParser', () => {
  let parser: StrictTscnParser;

  beforeEach(() => {
    parser = new StrictTscnParser();
  });

  describe('Invalid Heading Format', () => {
    it('reports no property error for the line a refused heading stops on', () => {
      const result = parser.parse('[gd_scene format=3]\n\n[node name="Root" type="Node3D"\n@\n');

      expect(result.errors.map(({ code, line }) => [code, line])).toEqual([['INVALID_HEADING_FORMAT', 3]]);
    });

    it('should report INVALID_HEADING_FORMAT for a heading missing its closing bracket', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.code).toBe('INVALID_HEADING_FORMAT');
      expect(result.errors[0]!.line).toBe(3);
      expect(result.errors[0]!.message).toContain('Invalid heading format');
      // The scene comes back, but a heading that cannot be parsed yields no
      // node, so the rule phase has nothing to walk.
      expect(result.scene?.nodes).toEqual([]);
    });

    it('should report every malformed heading (edge-malformed-bracket fixture shape)', () => {
      // Mirrors scenes/fixtures/edge-malformed-bracket.tscn: both lines open a
      // bracket but never close it. Without this the property-parsing fallback
      // swallows them and the file lints clean.
      const content = `[gd_scene format=3

[node name="Root" type="Node3D"
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]!.code).toBe('INVALID_HEADING_FORMAT');
      expect(result.errors[0]!.line).toBe(1);
      expect(result.errors[1]!.code).toBe('INVALID_HEADING_FORMAT');
      expect(result.errors[1]!.line).toBe(3);
      // Every heading was unparseable, so the scene comes back empty.
      expect(result.scene?.nodes).toEqual([]);
    });

    it('does not flag bracket-opening lines inside a multi-line value', () => {
      // Continuation lines of an accumulated value may legitimately start
      // with '[' (arrays/dicts spanning lines), so no INVALID_HEADING_FORMAT.
      const content = `[gd_scene load_steps=2 format=3]

[sub_resource type="SpriteFrames" id="sf_1"]
animations = [{
"frames": [],
"name": &"default"
}]

[node name="Root" type="Node3D"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      expect(result.scene!.internalResources).toHaveLength(1);
    });

    it('reads a heading split over lines as one heading, as Godot 4.6.3 loads it', () => {
      const content = `[gd_scene format=3]

[node name="Root"
type="Node3D"]
`;

      const result = parser.parse(content);

      expect(result.errors).toEqual([]);
      expect(result.scene?.nodes.map(({ name, type }) => ({ name, type }))).toEqual([
        { name: 'Root', type: 'Node3D' },
      ]);
    });

    it('reports a heading split over lines that does not parse at the line it starts on', () => {
      const content = `[gd_scene format=3]

[node name="Root"
type=]
`;

      expect(parser.parse(content).errors).toEqual([
        expect.objectContaining({ code: 'INVALID_HEADING_FORMAT', line: 3 }),
      ]);
    });

    it('should report error for heading without attributes', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node]
`;

      const result = parser.parse(content);

      expect(result.errors.length).toBeGreaterThan(0);
      const error = result.errors.find(
        (e) => e.code === 'MISSING_NODE_NAME' || e.code === 'MISSING_NODE_IDENTIFIER'
      );
      expect(error).toBeDefined();
    });
  });
});
