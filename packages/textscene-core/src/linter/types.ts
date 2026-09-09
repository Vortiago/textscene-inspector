/**
 * ESLint-style linter types for TSCN validation
 */

import type { TscnScene, TscnNode } from '../parser/types';

/**
 * Diagnostic severity levels, each decided by what the engine does with the
 * value (ADR-0032), never chosen per rule.
 * `error` — Godot refuses or alters the value, or cannot load the file, or the
 *   linter itself failed and cannot vouch for the run; fails CLI/CI, and no
 *   committed fixture may carry one.
 * `warning` — legal, and either Godot's own editor warns about it, or the value
 *   sits outside the property's editor hint, or the claim is about the FILE
 *   rather than the engine (a reference that resolves to nothing); advisory.
 * `info` — legal, and the engine reads the value and leaves it inert (a branch
 *   never entered, a mode that never consults the key), or the finding is about
 *   this previewer rather than the scene; advisory.
 * `severityFixedBy` states which grounding kinds fix which tier.
 */
export type Severity = 'error' | 'warning' | 'info';

/**
 * Canonical severity ranking (lower = more severe): error, warning, info.
 * The single source of truth for every severity comparison —
 * `Linter`'s own diagnostic sort, and any host (e.g. the web app's Source
 * pane gutter) that groups/ranks diagnostics by severity — so a future
 * severity level or reordering only needs updating here.
 */
export const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

/**
 * The tier names, for a reader that needs them as data rather than as a type —
 * the scrapes that build a severity alternation into a regex.
 *
 * Derived here rather than in each scraper: a tier spelled out at a match site
 * compiles everywhere and silently drops out of that scraper's population, and
 * two scrapers already derived this list separately.
 */
export const SEVERITIES = Object.keys(SEVERITY_ORDER) as Severity[];

/**
 * Whether a string is one of the three tiers — the test every reader that
 * ranks, sorts or maps a severity needs before indexing a table by it.
 *
 * `hasOwn` rather than a bare index: `SEVERITY_ORDER['constructor']` reads
 * `Object.prototype`'s own property back and passes a truthy check, while any
 * other unknown key yields `undefined`, and `undefined <= n` and `n <=
 * undefined` are BOTH false — so an unranked severity holds a gutter row
 * against every error behind it, and a comparator built on it returns `NaN`
 * and leaves the sort unordered. Beside the table rather than in each host:
 * this package's own sort, the CLI formatter, the VS Code squiggle map and
 * the web gutter all index it, and the test is the same one every time.
 */
export function isSeverity(value: string): value is Severity {
  return Object.hasOwn(SEVERITY_ORDER, value);
}

/**
 * The severity itself, or `info` where the union does not hold it — the one
 * place the floor TIER is chosen, as `isSeverity` is the one place the test is.
 *
 * `info` and not a throw: every reader of this runs inside an editor or a
 * webview with no error boundary, and a malformed tier is worth a
 * least-confident squiggle rather than a blank pane. Flooring low also fails in
 * the direction that under-reports: VS Code's own default for an absent
 * severity is Error, which reads to the author as the most serious thing in the
 * file.
 *
 * `string` in, like `isSeverity`: a reader holding a value the union already
 * covers needs no floor, so a parameter typed `Severity` is one no caller with
 * an off-union tier can pass.
 */
export function flooredSeverity(value: string): Severity {
  return isSeverity(value) ? value : 'info';
}

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
  /**
   * True when this refusal is about the KEY rather than the value it was handed
   * — an unrecognised leaf name, a shape `_set` cannot resolve, a negative
   * index — so every value fails it, `null` included.
   *
   * That parser's nil rewrite reads it, because "this slot stores the type's
   * zero instead" describes a slot the class does not have and would replace
   * the refusal's own reason and tier.
   *
   * `ownsNilMessage` is where it is asked, beside {@link ParseError.nilVerdict}.
   */
  keyVerdict?: true;

  /**
   * The section this refusal belongs to, when it belongs to one — a node's
   * `name=`, or a `[sub_resource]`'s `id=`.
   *
   * A property refusal is ABOUT one of them — "`draw_order` must be 0-1" is
   * useless without saying which of eleven CPUParticles2D wrote it, and
   * "`radius` must be non-negative" without saying which of five
   * `CircleShape2D` sub-resources — but the validator seam is handed a key and
   * a value, never the heading. The scanning loop has it (`onSectionStart`
   * carries the heading's attributes), so the identity is stamped on the error
   * there and `Linter.convertParseErrors` reads it back.
   *
   * ABSENT is meaningful and must stay reachable: a malformed heading, the
   * `format=` header itself, and a `.tres`'s `[resource]` body genuinely have
   * no such identity, and saying `<unknown>` for those is the honest answer
   * rather than a gap to fill.
   */
  nodeName?: string;
  /** See {@link ParseError.nodeName}. */
  nodeType?: string;

  /**
   * True when the refusal is about the bare `null` ITSELF: the slot exists and
   * the setter opens with an `ERR_FAIL_COND(...is_null())`, so the write is
   * refused and nothing is stored. `TileSet.sources/<id>` (`add_source`,
   * tile_set.cpp:477) and `TileSet.pattern_<n>` (`add_pattern`, :1359) are the
   * two.
   *
   * Both are OBJECT slots, which is exactly where the nil rewrite has nothing
   * true to say: `NIL -> OBJECT` is the one conversion `can_convert_strict`
   * allows, so no zero is stored in place of the null — the add is simply
   * refused, and only this refusal holds the guard's `file:line`.
   *
   * Like `keyVerdict` it rides on the ERROR, for the same reason: `findValidator`
   * hands the seam a family's dispatcher and `withFiniteGuard` hands it a
   * wrapper, so a tag on the validator that refused never arrives.
   */
  nilVerdict?: true;
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
 * (`configurationWarningCoverage.test.ts`): a prose excuse turns the kind into a
 * rubber stamp, while a category a reader can sort by makes a tired claim
 * visible next to a principled one.
 */
export type OutsideEngineScope =
  /**
   * Names a node path or a clip name the file itself never declares. The
   * engine loads the file and the reference resolves to nothing; a resource id
   * that dangles is `dangling-resource-reference`'s engine-grounded error.
   */
  | 'dangling-reference'
  /** Names a `res://` path this project does not contain, or one that cannot be read. */
  | 'unresolvable-path'
  /** A payload this previewer cannot decode, so it says so instead of drawing nothing. */
  | 'previewer-limitation'
  /** A `.tscn` a Godot save could not have produced — duplicate names, malformed sections. */
  | 'file-integrity'
  /**
   * A rule threw instead of reporting. About this linter, not the scene, yet an
   * error: the file's findings are incomplete and the run cannot vouch for it.
   */
  | 'linter-failure';

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
   * `emitsGrounding.test.ts` resolves it, and fails a kind with no census row.
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
   * A separate kind because the claim is about REACHABILITY, not about a bound.
   * ADR-0032's error/warning split cannot decide it - nothing is refused and
   * nothing is altered, so it is advisory by construction. Collapsing it into
   * `engine` was what let six independent audits disagree about whether
   * `sprite_2d.cpp:98`'s `if (region_enabled)` grounds anything: it does, but
   * not the way an `ERR_FAIL_COND` does, and the kind should say which.
   */
  | { readonly kind: 'engine-inert'; readonly at: string; readonly unused: string }
  /**
   * No engine counterpart, and legitimately so: the diagnostic is about the
   * FILE or about THIS previewer, not about what Godot does with a value.
   *
   * This is the kind that must not become comfortable. A condition that is
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
 * The severity a grounding fixes, or `undefined` where only the cited line can
 * decide: an `engine` arm is an error when the setter refuses or alters and a
 * warning when it is a hint or a load-time `WARN_PRINT`. Everything else is
 * settled by the kind — a ported editor warning warns, a value the engine reads
 * and leaves inert informs, a limitation of this previewer informs, a linter
 * failure errs, and the three scopes that describe the FILE rather than the
 * engine (`dangling-reference`, `unresolvable-path`, `file-integrity`) warn.
 * `emitsGrounding.test.ts` holds every emit to it.
 *
 * Total over BOTH unions: a new kind or scope fails tsc in the `default` arms
 * rather than returning `undefined`, which every caller reads as "the cite
 * decides" and which would let a whole grounding ship with no tier check. The
 * arms throw rather than returning the unmatched value, which is a string or a
 * whole grounding object wearing the `Severity` type.
 */
export function severityFixedBy(grounding: EmitGrounding): Severity | undefined {
  switch (grounding.kind) {
    case 'engine':
      return undefined;
    case 'configuration-warning':
      return 'warning';
    case 'engine-inert':
      return 'info';
    case 'no-engine-counterpart':
      switch (grounding.scope) {
        case 'previewer-limitation':
          return 'info';
        case 'linter-failure':
          return 'error';
        case 'dangling-reference':
        case 'unresolvable-path':
        case 'file-integrity':
          return 'warning';
        default: {
          const unmatched: never = grounding.scope;
          throw new Error(`no severity fixed for scope ${String(unmatched)}`);
        }
      }
    default: {
      const unmatched: never = grounding;
      throw new Error(`no severity fixed for grounding kind ${String((unmatched as EmitGrounding).kind)}`);
    }
  }
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
   * many user-visible `ruleName`s (`valid-sprite3d-resources` reports under
   * five, two of them errors). Those names are the ones a user sees and suppresses,
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
   * `emits` array first, so `grounding` cannot disturb the pairing.)
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
   * its own `applicableNodeTypes` / `applicableNodeTypeMatcher` here. That is a
   * second copy of a predicate that can disagree with the first: widening the
   * meta to cover a sibling type is then silently cancelled by the stale guard
   * below it.
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
