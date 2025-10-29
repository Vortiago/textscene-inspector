/**
 * Main linting engine for TSCN files
 */

import type { TscnScene, TscnNode } from '../parser/types.js';
import type { Diagnostic, RuleContext, ParseError } from './types.js';
import { ruleRegistry } from './RuleRegistry.js';
import { StrictTscnParser } from './StrictTscnParser.js';

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

    // Sort diagnostics by severity (errors first, then warnings, then info)
    return this.sortDiagnostics(diagnostics);
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
    const severityOrder = { error: 0, warning: 1, info: 2 };
    return diagnostics.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }
}
