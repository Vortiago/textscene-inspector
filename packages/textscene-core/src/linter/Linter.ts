/**
 * Main linting engine for TSCN files
 */

import type { TscnScene, TscnNode } from '../parser/types.js';
import { SEVERITY_ORDER, type Diagnostic, type RuleContext, type ParseError } from './types.js';
import { ruleRegistry } from './RuleRegistry.js';
import { StrictTscnParser } from './StrictTscnParser.js';
import { LEGACY_FORMAT_CEILING, readHeaderFormat } from './headerFormat.js';

export class Linter {
  private parser = new StrictTscnParser();

  /**
   * Lint TSCN file content with two-phase validation
   * Phase 1: Strict parsing (syntax/format errors)
   * Phase 2: Semantic validation (business logic rules)
   *
   * @param content - Raw TSCN file content
   * @returns Array of diagnostics (parse errors + rule violations)
   */
  lint(content: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Phase 0: the file's own format version. These rules are written against
    // the format Godot writes today, so an older one is declined whole rather
    // than reported against a grammar it predates.
    const legacy = this.legacyFormatDiagnostic(content);
    if (legacy) return [legacy];

    // Phase 1: Strict parsing
    const parseResult = this.parser.parse(content);

    // Convert parse errors to diagnostics
    if (parseResult.errors.length > 0) {
      diagnostics.push(...this.convertParseErrors(parseResult.errors));
    }

    // Phase 2: Semantic validation (only if parsing succeeded)
    if (parseResult.scene) {
      const semanticDiagnostics = this.lintScene(parseResult.scene);
      diagnostics.push(...semanticDiagnostics);
    }

    // Sort diagnostics by severity: errors first, then warnings.
    return this.sortDiagnostics(diagnostics);
  }

  /**
   * The one diagnostic a pre-current-format file gets, or `null` for every
   * other file.
   *
   * Suppressing the rest is the point, not a side effect. Version 3 gave
   * ext/subresources their string ids (`resource_format_text.h:44`), so on a
   * `format=2` file the reference rules read integer ids as dangling and every
   * property bound is judged against a grammar the file predates: those
   * diagnostics would be wrong, not merely noisy. The message says the
   * suppression out loud so the short result is not a mystery.
   *
   * It does NOT claim the file is invalid. The engine loads it — there is no
   * less-than comparison against the format version anywhere in
   * `resource_format_text.cpp` — so this reports the linter's scope, and warns
   * rather than errors.
   */
  private legacyFormatDiagnostic(content: string): Diagnostic | null {
    const header = readHeaderFormat(content);
    if (!header || header.format === null || header.format > LEGACY_FORMAT_CEILING) return null;
    return {
      severity: 'warning',
      // "3 or 4" rather than one number: one 4.6.3 saver writes both, choosing
      // per file (`resource_format_text.cpp:1798`).
      message:
        `Header format=${header.format} predates the text format Godot writes today (3 or 4). ` +
        'Lint rules target the current format, so nothing else in this file is reported. ' +
        'Open and re-save the file in Godot to migrate it.',
      nodeName: '<unknown>',
      nodeType: '<unknown>',
      ruleName: 'legacy-format-version',
      location: { line: header.line, column: 1 },
    };
  }

  /**
   * Convert parse errors to diagnostic format
   */
  private convertParseErrors(errors: ParseError[]): Diagnostic[] {
    return errors.map(error => ({
      severity: error.severity,
      message: error.message,
      nodeName: '<unknown>',
      nodeType: '<unknown>',
      ruleName: 'strict-parser',
      location: {
        line: error.line,
        column: error.column,
      },
    }));
  }

  /**
   * Lint a parsed TSCN scene (semantic validation)
   * @param scene - The parsed scene to validate
   * @returns Array of diagnostics found
   */
  private lintScene(scene: TscnScene): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Recursively validate all nodes in the scene tree
    for (const node of scene.nodes) {
      this.lintNode(scene, node, diagnostics);
    }

    return diagnostics;
  }

  /**
   * Recursively lint a node and its children
   */
  private lintNode(scene: TscnScene, node: TscnNode, diagnostics: Diagnostic[]): void {
    // Get applicable rules for this node type
    const rules = ruleRegistry.getRulesForNodeType(node.type);

    // Create rule context
    const context: RuleContext = {
      scene,
      node,
      properties: node.properties,
    };

    // Run all applicable rules
    for (const rule of rules) {
      const ruleDiagnostics = rule.check(context);
      diagnostics.push(...ruleDiagnostics);
    }

    // Recursively lint children
    for (const child of node.children) {
      this.lintNode(scene, child, diagnostics);
    }
  }

  /**
   * Sort diagnostics by severity
   */
  private sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
    return diagnostics.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  }
}
