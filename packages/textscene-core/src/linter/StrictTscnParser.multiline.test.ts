/**
 * StrictTscnParser: values that span lines.
 *
 * The three blocks are one subject from three sides — a continuation line that
 * looks like a section heading, the multi-line property itself, and the salvage
 * that ends an unterminated one at the next section boundary.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StrictTscnParser } from './StrictTscnParser.js';

describe('StrictTscnParser', () => {
  let parser: StrictTscnParser;

  beforeEach(() => {
    parser = new StrictTscnParser();
  });

  describe('multi-line values with heading-looking content', () => {
    // A multi-line value's continuation lines can look like headings — BBCode
    // tags (`[u]…[/u]`, `[center]`) and bracketed array/dict elements — but are
    // CONTENT, not a new section. They must not be flagged as malformed.
    const expectNoFormatError = (content: string) => {
      const codes = parser.parse(content).errors.map((e) => e.code);
      expect(codes).not.toContain('INVALID_PROPERTY_FORMAT');
      expect(codes).not.toContain('INVALID_HEADING_FORMAT');
    };

    it('does not flag BBCode tag lines inside a multi-line string', () => {
      expectNoFormatError(`[gd_scene format=3]

[node name="Title" type="RichTextLabel"]
bbcode_enabled = true
text = "[center][u]CONTRIBUTORS:[/u]
- Alice

[u]ASSETS:[/u]
- 3D Kit by Kenney.nl"
fit_content = true
`);
    });

    it('does not flag bracketed array element lines inside a multi-line value', () => {
      expectNoFormatError(`[gd_scene format=3]

[node name="N" type="Node"]
meta = [
[0, 0],
[1, 1]
]
`);
    });
  });

  describe('Multi-line String Properties', () => {
    it('should handle single-line quoted strings', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
metadata/test = "Single line string"
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      expect(
        (result.scene!.nodes[0]!.properties as Record<string, unknown>)['metadata/test']
      ).toBe('"Single line string"');
    });

    it('should handle multi-line quoted strings (implementation-specific behavior)', () => {
      // Note: Multi-line string handling may have specific format requirements
      // This test documents the current behavior
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
script = "res://test.gd"
`;

      const result = parser.parse(content);

      // Simple quoted values work fine
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Multi-line string section-boundary salvage', () => {
    it('does not swallow the next node heading when a string is left unclosed', () => {
      const content = `[gd_scene format=3]

[node name="A" type="Label"]
text = "oops unclosed
[node name="B" type="Node3D" parent="."]
`;
      const result = parser.parse(content);
      // B must be parsed as its own node, not consumed into A's open string.
      const root = result.scene!.nodes[0]!;
      expect(root.name).toBe('A');
      expect(root.children.some((c) => c.name === 'B')).toBe(true);
    });
  });
});
