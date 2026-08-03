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
   * many user-visible `ruleName`s (`valid-camera2d-properties` emits twelve, one
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
   * reverse order silently mispairs a severity.
   */
  emits?: ReadonlyArray<{ ruleName: string; severity: Severity }>;
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
