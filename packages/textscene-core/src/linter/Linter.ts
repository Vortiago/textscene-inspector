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
import { armDiagnostic } from './ruleArms.js';

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
   * Convert parse errors to diagnostic format.
   *
   * The owner comes from the error, which the scanning loop stamped while it
   * was inside that section's body ({@link ParseError.nodeName}). Reporting
   * every one of these as `<unknown>` made the linter's core product — a
   * grounded refusal of a property VALUE — unable to say which of a scene's
   * nodes wrote it, in the CLI's human output (`format.ts`) and its JSON alike.
   * A `[sub_resource]` body is named by its `id=`, since resource validators
   * run over it and several shapes of one type sit side by side.
   *
   * `<unknown>` remains the answer where it is the true one: a malformed
   * heading, the `format=` header, and a `.tres`'s `[resource]` body — the
   * file's own single resource, which no id identifies.
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
  const rootOrigin = scene.rootWithParent;
  const rootRefusal: Diagnostic[] = rootOrigin
    ? [
        armDiagnostic(
          FILE_DIAGNOSTICS.rootDeclaresParent,
          rootOrigin.node,
          `Root node '${rootOrigin.node.name}' declares parent="${rootOrigin.declaredParent}", ` +
            'which only a non-root heading may do. The file loads, but Godot refuses to ' +
            'instantiate the scene from it at all.',
          { line: rootOrigin.line, column: 1 }
        ),
      ]
    : [];

  // Heading 0 is dropped here rather than reported twice: `packed_scene.cpp`
  // reads `if (i > 0) { … } else { … }`, and BOTH claims below live in the
  // `i > 0` arm — the missing-parent refusal at `:207`, and the vanished-path
  // warning with its `nparent = ret_nodes[0]` re-root at `:208-215`. Heading 0
  // takes the `else`, so it is refused outright by the diagnostic above and no
  // rename is performed on it to describe. It is stranded only when its own
  // path resolves against nothing AND a later heading is parentless, which is
  // the case that reported both.
  const stranded = (scene.orphanedNodes ?? []).filter((origin) => origin !== rootOrigin);

  return rootRefusal.concat(
    stranded.map(({ node, line, declaredParent }) => {
      // The heading's own attribute, not `node.parent`: both parsers drop an
      // empty `parent=""`, while the loader keeps it — `add_node_path` returns
      // an index for any value the field carries (`packed_scene.cpp:2307-2311`),
      // so `n.parent` is never `-1` for one and the refusal cannot apply to it.
      const missing = declaredParent === undefined;
      return armDiagnostic(
        missing ? FILE_DIAGNOSTICS.nodeWithoutParent : FILE_DIAGNOSTICS.unresolvedParentPath,
        node,
        missing
          ? `Node '${node.name}' declares no 'parent', which only the scene's root node may omit. ` +
              'The file loads, but Godot cannot instantiate the scene from it at all.'
          : `Node '${node.name}' declares parent="${declaredParent}", a path this file never defines. ` +
              `Godot re-parents it to the scene root and renames it "${reparentedName(declaredParent, node.name)}". ` +
              'No semantic rule ran on it or on anything parented below it.',
        { line, column: 1 }
      );
    })
  );
}
