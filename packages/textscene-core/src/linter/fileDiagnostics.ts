/**
 * The diagnostics `Linter` reports about a FILE, which no rule can own.
 *
 * A `LintRule` reaches its subject through `applicableNodeTypes`, so a claim
 * about the header — or about a heading that never entered the tree — has no
 * slice to declare it and escapes `RuleMeta.emits` entirely. They are declared
 * here in the shape an emitted rule name uses, for the reason `RangeArm.cite`
 * is required: the alternative was the citation living in a prose comment and
 * the exempt names typed out in a test file, which is the parallel roster
 * `RuleMeta.exactClassByDesign` was written to avoid.
 *
 * `emitsGrounding.test.ts` sweeps these beside the registry's own arms, so a
 * cite here is checked exactly like any other.
 */

import type { RuleArm } from './ruleArms.js';

export const FILE_DIAGNOSTICS = {
  /**
   * A header older than the text format Godot writes today.
   *
   * The only one with no engine line to cite, and ADR-0032 says why: the text
   * loader compares the header version in three places and every one is `>`,
   * so 4.6.3 opens a `format=2` file and parses it with the current grammar.
   * Declining it is a decision about this tool's scope.
   */
  legacyFormat: {
    severity: 'warning',
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
   * node to the scene root and renames it `<path>#<name>` — so the file loads
   * and the node exists, in the wrong place under a different name.
   */
  unresolvedParentPath: {
    severity: 'warning',
    ruleName: 'unresolved-parent-path',
    grounding: { kind: 'engine', at: 'packed_scene.cpp:208-215' },
  },
  /**
   * A heading declaring no `parent=` while not being the root. The text loader
   * stores it without complaint (`resource_format_text.cpp:273`); the
   * instantiate below refuses, so the resource loads and the scene cannot be
   * built from it. `parent=""` is a different case and not this one: the loader
   * calls `add_node_path` for any value the field carries, which never returns
   * `-1` (`packed_scene.cpp:2307-2311`).
   */
  nodeWithoutParent: {
    severity: 'error',
    ruleName: 'node-without-parent',
    grounding: { kind: 'engine', at: 'packed_scene.cpp:206-207' },
  },
  /**
   * The mirror of the above, on the one heading the rule is inverted for: the
   * root may not declare a `parent=`, and any value refuses the instantiate.
   * `parent="."` reads as harmless and is not — it is the spelling a file
   * missing its root heading falls into, since every other heading declares one.
   */
  rootDeclaresParent: {
    severity: 'error',
    ruleName: 'root-declares-parent',
    grounding: { kind: 'engine', at: 'packed_scene.cpp:218-219' },
  },
  /**
   * A rule threw. Reported once, on the node it ran on, naming the rule and
   * the error; every other rule still runs. Not an engine claim about the
   * file: the rule's own findings for that node are simply missing.
   */
  ruleCrashed: {
    severity: 'error',
    ruleName: 'rule-crashed',
    grounding: {
      kind: 'no-engine-counterpart',
      scope: 'previewer-limitation',
      because: 'a rule threw instead of reporting; the linter says which one rather than dropping the file',
    },
  },
  /**
   * A well-formed `SubResource("id")` / `ExtResource("id")` in a registered
   * resource slot whose id the file never declares. Not a slice's claim: the
   * loader resolves the reference while tokenising the VALUE, before any
   * setter, so every slot fails the same way (`danglingResources.ts`). The ext
   * twin is `resource_format_text.cpp:138`.
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
