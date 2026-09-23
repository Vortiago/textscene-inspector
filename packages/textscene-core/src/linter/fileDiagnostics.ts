/**
 * The diagnostics `Linter` reports about a file, which no rule can own: a `LintRule` reaches its subject through
 * `applicableNodeTypes`, so a claim about the header or a heading outside the tree escapes `RuleMeta.emits`. They take
 * an emitted rule's shape, cite included, rather than a prose cite and a parallel roster of exempt names in a test.
 * `emitsGrounding.test.ts` checks these cites beside the registry's own arms.
 */

import type { RuleArm } from './ruleArms.js';

export const FILE_DIAGNOSTICS = {
  /**
   * A header older than the text format Godot writes today. The only one with no engine line to cite (ADR-0032): the
   * loader's three header-version comparisons are all `>`, so 4.6.3 parses a `format=2` file with the current grammar.
   * Declining it is a decision about this tool's scope.
   */
  legacyFormat: {
    severity: 'info',
    ruleName: 'legacy-format-version',
    grounding: {
      kind: 'no-engine-counterpart',
      scope: 'previewer-limitation',
      because:
        'the engine reads the file; the rules are written against the format it writes today',
    },
  },
  /**
   * A `parent=` path that resolves against nothing. Godot warns, re-parents the
   * node to the scene root and renames it `<path>#<name>`, so the file loads
   * and the node exists, in the wrong place under a different name.
   */
  unresolvedParentPath: {
    severity: 'warning',
    ruleName: 'unresolved-parent-path',
    grounding: { kind: 'engine', at: 'packed_scene.cpp:208-215' },
  },
  /**
   * `parent=""`, which the text loader cannot read: it calls `prepend_period()` on the NodePath unconditionally
   * (`resource_format_text.cpp:206-207`), which dereferences `data` with no null check (`node_path.cpp:43-44`), and
   * `NodePath("")` leaves `data` unset (`:394-397`). The load faults before any node is made, so this is an error and
   * outranks the vanished-path warning.
   */
  emptyParentPath: {
    severity: 'error',
    ruleName: 'empty-parent-path',
    grounding: { kind: 'engine', at: 'resource_format_text.cpp:206-207' },
  },
  /**
   * A heading declaring no `parent=` while not being the root. The loader stores it (`resource_format_text.cpp:273`)
   * and the instantiate refuses, so the resource loads and no scene builds from it. `parent=""` is `emptyParentPath`
   * instead: the loader calls `add_node_path` for any value, which never returns `-1` (`packed_scene.cpp:2307-2311`).
   */
  nodeWithoutParent: {
    severity: 'error',
    ruleName: 'node-without-parent',
    grounding: { kind: 'engine', at: 'packed_scene.cpp:206-207' },
  },
  /**
   * The mirror of the above, on the one heading the rule is inverted for: the
   * root may not declare a `parent=`, and any value refuses the instantiate.
   * `parent="."` reads as harmless and is not: it is the spelling a file
   * missing its root heading falls into, since every other heading declares one.
   */
  rootDeclaresParent: {
    severity: 'error',
    ruleName: 'root-declares-parent',
    grounding: { kind: 'engine', at: 'packed_scene.cpp:218-219' },
  },
  /**
   * A rule threw. Reported on the node it ran on, naming the rule and the
   * error. Every other rule still runs. Not an engine claim about the
   * file: the rule's own findings for that node are simply missing.
   */
  ruleCrashed: {
    severity: 'error',
    ruleName: 'rule-crashed',
    grounding: {
      kind: 'no-engine-counterpart',
      scope: 'linter-failure',
      because: 'a rule threw instead of reporting; the linter says which one rather than dropping the file',
    },
  },
  /**
   * A well-formed `SubResource("id")` / `ExtResource("id")` in a registered resource slot whose id the file never
   * declares. Not a slice's claim: the loader resolves it while tokenising the value, before any setter, so every slot
   * fails the same way (`danglingResources.ts`). The ext twin is `resource_format_text.cpp:138`.
   */
  danglingResourceReference: {
    severity: 'error',
    ruleName: 'dangling-resource-reference',
    grounding: { kind: 'engine', at: 'resource_format_text.cpp:113' },
  },
} as const satisfies Record<string, RuleArm>;

/**
 * `strict-parser`, the name Phase 1 stamps on every validator's `ParseError`.
 *
 * Not a row above: its severity and message come from the validator that
 * produced the error, and its authority is that validator's own `grounding`.
 */
export const STRICT_PARSER_RULE_NAME = 'strict-parser';

/** Every `ruleName` `Linter` stamps that no registered rule declares. */
export const FILE_DIAGNOSTIC_NAMES: ReadonlySet<string> = new Set([
  STRICT_PARSER_RULE_NAME,
  ...Object.values(FILE_DIAGNOSTICS).map((d) => d.ruleName),
]);
