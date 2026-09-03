/**
 * Linter: turning a strict-parser `ParseError` into a diagnostic — position,
 * severity, message and the `strict-parser` rule name. `Diagnostic` has no
 * `code`, so the `ParseError` one does not survive the conversion.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from './Linter.js';

describe('Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Parse Error to Diagnostic Conversion', () => {
    it('should set ruleName to "strict-parser" for parse errors', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root"]
`;

      const diagnostics = linter.lint(content);

      expect(diagnostics.length).toBeGreaterThan(0);
      diagnostics.forEach(d => {
        expect(d.ruleName).toBe('strict-parser');
      });
    });

    it('names the node a heading diagnostic is about, and only guesses the part it lacks', () => {
      // The heading declares a name and no type, which is the very thing being
      // reported — so the name is known and the type genuinely is not.
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root"]
`;

      const diagnostics = linter.lint(content);

      expect(diagnostics.length).toBeGreaterThan(0);
      diagnostics.forEach(d => {
        expect(d.nodeName).toBe('Root');
        expect(d.nodeType).toBe('<unknown>');
      });
    });

    it('names the node the scan was inside, not the first one in the file', () => {
      // The stamp has to TRACK the current heading. A scene whose defect is on
      // its third node catches a conversion that just reports node one — and a
      // property refusal, the linter's core product, is attributed by the same
      // mechanism. (Property validators need the slice barrel, which this
      // registry-free suite deliberately does not import, so the heading arm
      // stands in; `fixtureLint` and the CLI cover the property arm end to end.)
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="Lamp" type="OmniLight3D" parent="."]

[node name="Stranded"]
`;

      const diagnostics = linter.lint(content);
      const stranded = diagnostics.find(d => d.message.includes('has vanished'));

      expect(stranded).toBeDefined();
      expect(stranded?.nodeName).toBe('Stranded');
    });

    it('keeps <unknown> for a diagnostic that belongs to no node', () => {
      // A malformed heading is the line that would have OPENED a node, so there
      // is no node to name and the previous one must not be borrowed.
      const content = `[gd_scene format=3

[node name="Root" type="Node3D"
`;

      const diagnostics = linter.lint(content);

      expect(diagnostics.length).toBeGreaterThan(0);
      diagnostics.forEach(d => {
        expect(d.nodeName).toBe('<unknown>');
        expect(d.nodeType).toBe('<unknown>');
      });
    });

    it('should preserve line and column information', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root"]
`;

      const diagnostics = linter.lint(content);

      expect(diagnostics.length).toBeGreaterThan(0);
      const diagnostic = diagnostics[0]!;

      expect(diagnostic.location).toBeDefined();
      expect(diagnostic.location!.line).toBe(3);
      expect(diagnostic.location!.column).toBe(1);
    });

    it('should preserve error severity', () => {
      // `[node type=…]` with no `name=`: a typeless heading is legal and warns.
      const content = `[gd_scene load_steps=1 format=3]

[node type="Node2D"]
`;

      const diagnostics = linter.lint(content);

      expect(diagnostics.length).toBeGreaterThan(0);
      diagnostics.forEach(d => {
        expect(d.severity).toBe('error');
      });
    });

    it('should preserve error message', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root"]
`;

      const diagnostics = linter.lint(content);

      expect(diagnostics.length).toBeGreaterThan(0);
      const diagnostic = diagnostics[0]!;

      expect(diagnostic.message).toBeTruthy();
      expect(typeof diagnostic.message).toBe('string');
    });
  });
});
