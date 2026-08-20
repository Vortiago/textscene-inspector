/**
 * Main linting engine for TSCN files
 */

import type { TscnScene, TscnNode } from '../parser/types.js';
import { SEVERITY_ORDER, type Diagnostic, type RuleContext, type ParseError } from './types.js';
import { ruleRegistry } from './RuleRegistry.js';
import { StrictTscnParser } from './StrictTscnParser.js';
import { LEGACY_FORMAT_CEILING, readHeaderFormat } from './headerFormat.js';
import {
  FILE_DIAGNOSTICS,
  STRICT_PARSER_RULE_NAME,
} from './fileDiagnostics.js';

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
      for (const d of this.convertParseErrors(parseResult.errors)) diagnostics.push(d);
    }

    // Phase 2: Semantic validation (only if parsing succeeded)
    if (parseResult.scene) {
      for (const d of orphanDiagnostics(parseResult.scene)) diagnostics.push(d);
      for (const d of this.lintScene(parseResult.scene)) diagnostics.push(d);
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
      severity: FILE_DIAGNOSTICS.legacyFormat.severity,
      // "3 or 4" rather than one number: one 4.6.3 saver writes both, choosing
      // per file (`resource_format_text.cpp:1798`).
      message:
        `Header format=${header.format} predates the text format Godot writes today (3 or 4). ` +
        'Lint rules target the current format, so nothing else in this file is reported. ' +
        'Open and re-save the file in Godot to migrate it.',
      nodeName: '<unknown>',
      nodeType: '<unknown>',
      ruleName: FILE_DIAGNOSTICS.legacyFormat.ruleName,
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
      ruleName: STRICT_PARSER_RULE_NAME,
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
      // Appended one at a time: a rule that walks an indexed family reports
      // per index, and spreading 130,000 arguments exceeds the call limit —
      // which threw out of `lint` and returned NO diagnostics for the file.
      for (const diagnostic of rule.check(context)) diagnostics.push(diagnostic);
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

/**
 * Godot's own name for a re-parented orphan: the vanished path with `./`
 * stripped and every `/` turned into `@`, then `#` and the node's own name
 * (`packed_scene.cpp:212`, `:561-563`).
 */
function reparentedName(parentPath: string, name: string): string {
  return `${parentPath.replace(/^\.\//, '').replaceAll('/', '@')}#${name}`;
}

/**
 * One diagnostic per `[node]` heading the tree build could not place.
 *
 * Phase 2 walks the tree, so a node missing from it — together with every
 * descendant, whose own path resolves only through it — is skipped by every
 * semantic rule with nothing said. Phase 1 is unaffected: property validation
 * happens during the scan, so the claim below is exactly that narrow.
 *
 * Both tiers and both citations are declared in `fileDiagnostics.ts`, where
 * `emitsGrounding` sweeps them beside the registry's own arms. Godot warns and
 * recovers from a vanished path, and refuses the instantiate outright for a
 * second parentless heading — which is why one is a warning and the other an
 * error. The rename spelling is `:561-563`, one line below the re-root.
 */
function orphanDiagnostics(scene: TscnScene): Diagnostic[] {
  const { node: root, line: rootLine, declaredParent: rootParent } = scene.rootWithParent ?? {};
  const rootRefusal: Diagnostic[] =
    root === undefined
      ? []
      : [
          {
            ...FILE_DIAGNOSTICS.rootDeclaresParent,
            message:
              `Root node '${root.name}' declares parent="${rootParent}", which only a non-root heading may do. ` +
              'The file loads, but Godot refuses to instantiate the scene from it at all.',
            nodeName: root.name,
            nodeType: root.type,
            location: { line: rootLine!, column: 1 },
          },
        ];

  return rootRefusal.concat((scene.orphanedNodes ?? []).map(({ node, line, declaredParent }) => {
    // The heading's own attribute, not `node.parent`: both parsers drop an empty
    // `parent=""`, while the loader keeps it — `add_node_path` returns an index
    // for any value the field carries (`packed_scene.cpp:2307-2311`), so
    // `n.parent` is never `-1` for one and the refusal below cannot apply to it.
    const { severity, ruleName } =
      declaredParent === undefined
        ? FILE_DIAGNOSTICS.nodeWithoutParent
        : FILE_DIAGNOSTICS.unresolvedParentPath;
    return {
      severity,
      ruleName,
      message:
        declaredParent === undefined
          ? `Node '${node.name}' declares no 'parent', which only the scene's root node may omit. ` +
            'The file loads, but Godot cannot instantiate the scene from it at all.'
          : `Node '${node.name}' declares parent="${declaredParent}", a path this file never defines. ` +
            `Godot re-parents it to the scene root and renames it "${reparentedName(declaredParent, node.name)}". ` +
            'No semantic rule ran on it or on anything parented below it.',
      nodeName: node.name,
      nodeType: node.type,
      location: { line, column: 1 },
    };
  }));
}
