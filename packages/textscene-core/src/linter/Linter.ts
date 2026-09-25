/** The linting engine for TSCN files: strict parsing, then the semantic rules. */

import type { TscnScene, TscnNode } from '../parser/types.js';
import { orphanDiagnostics } from './orphanDiagnostics.js';
import { danglingResourceDiagnostics } from './danglingResources.js';
import {
  SEVERITY_ORDER,
  flooredSeverity,
  type Diagnostic,
  type RuleContext,
  type ParseError,
  type SourceLines,
} from './types.js';
import { ruleRegistry } from './RuleRegistry.js';
import { StrictTscnParser } from './StrictTscnParser.js';
import { isLegacyFormat, readHeaderFormat } from './headerFormat.js';
import { FILE_DIAGNOSTICS, STRICT_PARSER_RULE_NAME } from './fileDiagnostics.js';
import { armDiagnostic } from './ruleArms.js';
import { headingLocation } from './sourceLocation.js';

/**
 * `diagnostic` put on `heading`, unless it carries a location of its own. A copy, not a write:
 * a rule may hand back one object for several nodes.
 */
function onHeading(diagnostic: Diagnostic, heading: Diagnostic['location']): Diagnostic {
  if (diagnostic.location || !heading) return diagnostic;
  return { ...diagnostic, location: heading };
}

export class Linter {
  private parser = new StrictTscnParser();

  /**
   * Lint TSCN file content in two phases: strict parsing (syntax and format errors), then the semantic rules.
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

    // Phase 1: strict parsing.
    const parseResult = this.parser.parse(content);

    if (parseResult.errors.length > 0) {
      for (const d of this.convertParseErrors(parseResult.errors)) diagnostics.push(d);
    }

    // Phase 2: semantic rules, on every scene the strict parser could build.
    // A property error does not withhold the tree, so a file reports its parse
    // errors and the semantic findings underneath them together.
    if (parseResult.scene) {
      const { scene, lines } = parseResult;
      for (const d of orphanDiagnostics(scene)) diagnostics.push(d);
      for (const d of danglingResourceDiagnostics(scene, lines)) diagnostics.push(d);
      for (const d of this.lintScene(scene, lines)) diagnostics.push(d);
    }

    return this.sortDiagnostics(diagnostics);
  }

  /**
   * The one diagnostic a pre-current-format file gets, or `null` for every other file. Version 3 gave ext/subresources
   * string ids (`resource_format_text.h:44`), so on a `format=2` file every other diagnostic would be wrong, not noisy.
   * It does not claim the file is invalid: the engine loads it, with no less-than comparison against the format version in
   * `resource_format_text.cpp`. So it is a claim about the linter's scope, reported at `info`, and it names the suppression.
   */
  private legacyFormatDiagnostic(content: string): Diagnostic | null {
    const header = readHeaderFormat(content);
    if (!header || !isLegacyFormat(header.format)) return null;
    return armDiagnostic(
      FILE_DIAGNOSTICS.legacyFormat,
      { name: '<unknown>', type: '<unknown>' },
      // "3 or 4" rather than one number: one 4.6.3 saver writes both, choosing
      // per file (`resource_format_text.cpp:1798`).
      `Header format=${header.format} predates the text format Godot writes today (3 or 4). ` +
        'Lint rules target the current format, so nothing else in this file is reported. ' +
        'Open and re-save the file in Godot to migrate it.',
      { line: header.line, column: 1 }
    );
  }

  /**
   * Parse errors as diagnostics. The owner is the section the scanning loop was inside ({@link ParseError.nodeName}),
   * so a refused property value names the node that wrote it. A `[sub_resource]` body is named by its `id=`, since
   * several shapes of one type sit side by side. `<unknown>` is the true owner of a malformed heading, the `format=`
   * header and a `.tres`'s `[resource]` body, which no id identifies.
   */
  private convertParseErrors(errors: ParseError[]): Diagnostic[] {
    return errors.map(error => ({
      severity: error.severity,
      message: error.message,
      nodeName: error.nodeName ?? '<unknown>',
      nodeType: error.nodeType ?? '<unknown>',
      ruleName: STRICT_PARSER_RULE_NAME,
      location: {
        line: error.line,
        column: error.column,
      },
    }));
  }

  /**
   * Run the semantic rules over a parsed TSCN scene.
   * @param scene - The parsed scene to validate
   * @param lines - Where each node of `scene` sits, for the heading each diagnostic is put on
   * @returns Array of diagnostics found
   */
  private lintScene(scene: TscnScene, lines: SourceLines): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const node of scene.nodes) {
      this.lintNode(scene, node, lines, diagnostics);
    }

    return diagnostics;
  }

  /**
   * Lint a node and, recursively, its children. Every diagnostic it reports is about `node`
   * (`LintRule.check`), so one without a `location` goes on the node's heading.
   */
  private lintNode(scene: TscnScene, node: TscnNode, lines: SourceLines, diagnostics: Diagnostic[]): void {
    const rules = ruleRegistry.getRulesForNodeType(node.type);
    const heading = headingLocation(lines, node);

    const context: RuleContext = {
      scene,
      node,
      properties: node.properties,
    };

    for (const rule of rules) {
      // Appended one at a time: an indexed-family rule reports per index, and spreading 130,000 arguments
      // exceeds the call limit. A throw in one rule is that rule's own diagnostic and the walk goes on:
      // no host catches around `lint`, so an uncaught throw drops every diagnostic of the file.
      try {
        for (const diagnostic of rule.check(context)) diagnostics.push(onHeading(diagnostic, heading));
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        diagnostics.push(
          armDiagnostic(
            FILE_DIAGNOSTICS.ruleCrashed,
            node,
            `Rule '${rule.meta.name}' threw while linting '${node.name}': ${reason}. ` +
              'Its own findings for this node are missing; every other rule ran.',
            heading
          )
        );
      }
    }

    for (const child of node.children) {
      this.lintNode(scene, child, lines, diagnostics);
    }
  }

  /**
   * Sort diagnostics by severity, errors first, an unranked tier floored to `info`. A bare index gives `undefined` for
   * a severity outside the union, and the `NaN` difference reads as "equal", leaving the order undecided.
   */
  private sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
    return diagnostics.sort(
      (a, b) => SEVERITY_ORDER[flooredSeverity(a.severity)] - SEVERITY_ORDER[flooredSeverity(b.severity)]
    );
  }
}
