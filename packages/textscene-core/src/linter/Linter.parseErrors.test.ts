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

    it('should set nodeName to "<unknown>" for parse errors', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root"]
`;

      const diagnostics = linter.lint(content);

      expect(diagnostics.length).toBeGreaterThan(0);
      diagnostics.forEach(d => {
        expect(d.nodeName).toBe('<unknown>');
      });
    });

    it('should set nodeType to "<unknown>" for parse errors', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root"]
`;

      const diagnostics = linter.lint(content);

      expect(diagnostics.length).toBeGreaterThan(0);
      diagnostics.forEach(d => {
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
