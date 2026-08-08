/**
 * ESLint-style linter types for TSCN validation
 */

import type { TscnScene, TscnNode } from '../parser/types';

/**
 * Diagnostic severity levels.
 * `error` — objectively invalid per the TSCN format; fails CLI/CI.
 * `warning` — legal but suspicious; advisory only.
 */
export type Severity = 'error' | 'warning';

/**
 * Canonical severity ranking (lower = more severe): error, then warning.
 * The single source of truth for every severity comparison —
 * `Linter`'s own diagnostic sort, and any host (e.g. the web app's Source
 * pane gutter) that groups/ranks diagnostics by severity — so a future
 * severity level or reordering only needs updating here.
 */
export const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1 };

/**
 * A diagnostic message reporting an issue
 */
export interface Diagnostic {
  /** Severity level of the diagnostic */
  severity: Severity;
  /** Human-readable diagnostic message */
  message: string;
  /** Name of the node where the issue was found */
  nodeName: string;
  /** Type of the node where the issue was found */
  nodeType: string;
  /** Name of the rule that generated this diagnostic */
  ruleName: string;
  /** Optional source location information */
  location?: {
    /** Line number in source file (if available) */
    line?: number;
    /** Column number in source file (if available) */
    column?: number;
  };
}

/**
 * Parse error from strict parser (syntax/format issues)
 */
export interface ParseError {
  /**
   * Severity of the finding.
   *
   * A FORMAT failure is always an error: the value cannot be parsed, so the
   * file is malformed whatever the engine would do with it. A RANGE failure
   * depends on the engine (ADR-0032): an error only where the setter refuses
   * or alters the value, a warning where the value merely sits outside the
   * property's PROPERTY_HINT_RANGE.
   */
  severity: Severity;
  /** Human-readable error message */
  message: string;
  /** Line number where error occurred */
  line: number;
  /** Column number where error occurred */
  column: number;
  /** Machine-readable error code */
  code: string;
}

/**
 * Result from strict parser
 */
export interface StrictParseResult {
  /** Parse errors found during strict parsing */
  errors: ParseError[];
  /**
   * The parsed scene. Present whenever the scanner produced one, INCLUDING
   * when `errors` is non-empty: a bad property value does not invalidate the
   * tree, and withholding it made `Linter` skip its whole rule phase, so one
   * bad value silenced every semantic rule in the file. Absent only if the
   * scanner could not run at all.
   */
  scene?: TscnScene;
}

/**
 * Context provided to lint rules during execution
 */
export interface RuleContext {
  /** The complete parsed scene */
  scene: TscnScene;
  /** The current node being validated */
  node: TscnNode;
  /** Convenience access to node properties (typed as unknown for flexibility) */
  properties: unknown;
}

/**
 * Why a diagnostic that is NOT about Godot semantics is still worth reporting.
 *
 * Typed rather than free text for the reason `DeclineCategory` is
 * (`configurationWarningCoverage.test.ts`): a prose excuse turns the arm into a
 * rubber stamp, while a category a reader can sort by makes a tired claim
 * visible next to a principled one.
 */
export type OutsideEngineScope =
  /** Names a resource id the file itself never declares. Godot fails the load. */
  | 'dangling-reference'
  /** Names a `res://` path this project does not contain, or one that cannot be read. */
  | 'unresolvable-path'
  /** A payload this previewer cannot decode, so it says so instead of drawing nothing. */
  | 'previewer-limitation'
  /** A `.tscn` a Godot save could not have produced — duplicate names, malformed sections. */
  | 'file-integrity';

/**
 * Where one reported diagnostic's authority comes from.
 *
 * ADR-0032 governs a validator's bounds through `PropertyValidator.grounding`,
 * and every `RangeArm` carries a `cite`. A semantic rule's diagnostics were the
 * hole in that: `check()` is free code, so a hand-rolled condition with no
 * engine counterpart was invisible to every guard. This closes it at the same
 * granularity the reports happen at — one grounding per emitted `ruleName`,
 * because one registered rule routinely reports under many
 * (`valid-camera2d-properties` emits five, grounded two different ways).
 *
 * Required, not optional, for the reason `RangeArm.cite` is: the compiler then
 * rejects an ungrounded diagnostic everywhere, with no sweep to keep honest and
 * no budget number to ratchet down.
 */
export type EmitGrounding =
  /**
   * A ported `Node::get_configuration_warnings()` row.
   *
   * The `file.cpp:line` deliberately does NOT appear here.
   * `configurationWarningCoverage.test.ts`'s census already holds it for every
   * ported row, keyed by this exact `ruleName`; re-typing it beside the rule
   * would create a second roster that can drift from the first.
   * `emitsGrounding.test.ts` resolves it, and fails an arm with no census row.
   */
  | { readonly kind: 'configuration-warning' }
  /**
   * An engine rule that is not a configuration warning: a setter that refuses
   * or alters, a `PROPERTY_HINT_RANGE`, `packed_scene.cpp`'s resolution order,
   * a `DISABLE_DEPRECATED` alias. `at` is its `file.cpp:line` in Godot 4.6.3.
   */
  | { readonly kind: 'engine'; readonly at: string }
  /**
   * The engine READS the value, and the read is what makes the authored value
   * inert: a branch this file never enters, a mode that never consults the key,
   * a sibling flag that gates the whole group. `at` is that line, `unused` says
   * in one clause what the value does not do.
   *
   * A separate arm because the claim is about REACHABILITY, not about a bound.
   * ADR-0032's error/warning split cannot decide it - nothing is refused and
   * nothing is altered, so it is advisory by construction. Collapsing it into
   * `engine` was what let six independent audits disagree about whether
   * `sprite_2d.cpp:98`'s `if (region_enabled)` grounds anything: it does, but
   * not the way an `ERR_FAIL_COND` does, and the arm should say which.
   */
  | { readonly kind: 'engine-inert'; readonly at: string; readonly unused: string }
  /**
   * No engine counterpart, and legitimately so: the diagnostic is about the
   * FILE or about THIS previewer, not about what Godot does with a value.
   *
   * This is the arm that must not become comfortable. A condition that is
   * neither engine-grounded nor one of these scopes is an invented rule, and
   * the honest outcome for one of those is deletion (ADR-0032: severity comes
   * from engine source, and documentation prose is never a basis).
   */
  | {
      readonly kind: 'no-engine-counterpart';
      readonly scope: OutsideEngineScope;
      readonly because: string;
    };

/**
 * Rule metadata
 */
export interface RuleMeta {
  /** Unique rule name (e.g., "no-missing-resource", "valid-property-values") */
  name: string;
  /** Human-readable description of what the rule checks */
  description: string;
  /** Rule category for organization */
  category: 'validation' | 'performance' | 'best-practice';
  /** Node types this rule applies to (empty = all nodes) */
  applicableNodeTypes?: string[];
  /**
   * Predicate applicability — when present it decides applicability on its own
   * (taking precedence over `applicableNodeTypes`), so a rule can reach a whole
   * family (e.g. every `*3D` subclass) without enumerating each type. Rules
   * without a matcher keep exact `applicableNodeTypes` matching.
   */
  applicableNodeTypeMatcher?: (nodeType: string) => boolean;
  /**
   * Every `ruleName`/`severity` pair this rule's `check` can emit.
   *
   * `name` is the REGISTRY key; a single registered rule routinely reports under
   * many user-visible `ruleName`s (`valid-sprite3d-resources` emits four, one
   * of them the only error). Those names are the ones a user sees and suppresses,
   * and until now nothing could enumerate them: they are string literals inside
   * `check`, and the shared physics factories build theirs by interpolation, so
   * no static scrape reaches them.
   *
   * Declaring them here makes the set readable from the live registry — which is
   * what generates each comparison sheet's Linting chapter. `ruleCoverage.test.ts`
   * holds it to the literals in the file (factories excepted, see there).
   *
   * WHEN WRITING A RULE: put `severity:` before `ruleName:` in every diagnostic
   * object literal. The coverage guard pairs the two by source order, so the
   * reverse order silently mispairs a severity. (That scrape strips the whole
   * `emits` array first, so `grounding` cannot disturb the pairing — but it
   * bracket-matches to find the array's end, so no string inside one may
   * contain `[` or `]`.)
   *
   * Each entry also says where its authority comes from; see `EmitGrounding`.
   */
  emits?: ReadonlyArray<{ ruleName: string; severity: Severity; grounding: EmitGrounding }>;
  /**
   * `file:line` of the engine guard that confines this rule to ONE exact class,
   * when Godot itself does not extend the condition to that class's subclasses.
   *
   * `ruleCoverage` otherwise fails a rule that names a type with descendants,
   * because exact-match applicability means it goes silent on every one of them
   * — which is nearly always a defect. `container.cpp:210` is the exception
   * that proves it: Godot guards with `get_class() == "Container"`, so a bare
   * unscripted Container warns and a VBoxContainer does not.
   *
   * Declared here rather than in a list inside the guard, for the same reason
   * `Grounding` and `RangeArm.cite` are declared on the thing they describe: a
   * second such rule should be able to state its own exemption in its own file,
   * instead of discovering that a test elsewhere keeps a parallel roster.
   */
  exactClassByDesign?: string;
}

/**
 * A lint rule that validates TSCN nodes
 */
export interface LintRule {
  /** Rule metadata */
  meta: RuleMeta;
  /**
   * Check function that validates a node and returns diagnostics.
   *
   * **Applicability is already decided.** `RuleRegistry.getRulesForNodeType`
   * filters by `meta` before `Linter` calls this, so a rule must NOT re-assert
   * its own `applicableNodeTypes` / `applicableNodeTypeMatcher` here. Fifty
   * rules used to, which is a second copy of a predicate that can disagree with
   * the first: widening the meta to cover a sibling type would then be silently
   * cancelled by the stale guard below it.
   *
   * Checking something ELSE about the tree — a parent's type, a child's
   * presence — is a different thing and belongs here (see
   * `vehiclewheel3d/linter.ts`, which asserts its PARENT is a VehicleBody3D).
   *
   * @param context - The rule execution context
   * @returns Array of diagnostics (empty if no issues found)
   */
  check: (context: RuleContext) => Diagnostic[];
}
