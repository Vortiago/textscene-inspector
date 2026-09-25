/** The linter's diagnostic, rule and grounding types for `.tscn` validation. */

import type { TscnScene, TscnNode } from '../parser/types';

/**
 * `error`: Godot refuses or alters the value or cannot load the file, or the linter failed. Fails CI.
 * `warning`: legal, but the editor warns, the value is outside the hint, or the claim is about the file.
 * `info`: legal, and the engine leaves the value inert, or the finding is about this previewer.
 * The engine decides each tier (ADR-0032), never the rule. No committed fixture carries an error.
 */
export type Severity = 'error' | 'warning' | 'info';

/**
 * Canonical severity ranking (lower is more severe): error, warning, info.
 * Every severity comparison reads it: `Linter`'s sort and every host that
 * ranks diagnostics, such as the web Source pane gutter.
 */
export const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

/**
 * The tier names as data, for the scrapes that build a severity alternation
 * into a regex. Derived here, not in each scraper: a tier spelled out at a
 * match site compiles and silently drops out of that scraper's population.
 */
export const SEVERITIES = Object.keys(SEVERITY_ORDER) as Severity[];

/**
 * Whether a string is one of the three tiers: the test every reader needs
 * before it indexes a table by severity. The sort, the CLI formatter, the
 * VS Code squiggle map and the web gutter all share it.
 */
export function isSeverity(value: string): value is Severity {
  // `hasOwn`, not a bare index: `SEVERITY_ORDER['constructor']` reads
  // `Object.prototype`, and an unknown key yields `undefined`, which compares
  // false both ways and leaves a sort unordered.
  return Object.hasOwn(SEVERITY_ORDER, value);
}

/**
 * The severity itself, or `info` where the union does not hold it. `info`, not
 * a throw: every reader runs in an editor or webview with no error boundary,
 * and VS Code's default for an absent severity is Error, which over-reports.
 * Takes a `string`, since a caller with an off-union tier cannot pass `Severity`.
 */
export function flooredSeverity(value: string): Severity {
  return isSeverity(value) ? value : 'info';
}

/** A diagnostic reported by a semantic rule. */
export interface Diagnostic {
  severity: Severity;
  message: string;
  nodeName: string;
  nodeType: string;
  ruleName: string;
  location?: {
    line?: number;
    column?: number;
  };
}

/** A property or syntax refusal from the strict parser. */
export interface ParseError {
  /**
   * A format failure is always an error: the file is malformed whatever the
   * engine does. A range failure is an error only where the setter refuses or
   * alters the value, and a warning outside PROPERTY_HINT_RANGE (ADR-0032).
   */
  severity: Severity;
  message: string;
  line: number;
  column: number;
  /** Machine-readable error code. */
  code: string;
  /**
   * True when the refusal is about the key, not the value: an unrecognised leaf
   * name, a shape `_set` cannot resolve, a negative index. Every value fails it,
   * `null` included, so `ownsNilMessage` keeps the nil rewrite off it, as for
   * {@link ParseError.nilVerdict}: it describes a slot the class lacks.
   */
  keyVerdict?: true;

  /**
   * The section the refusal belongs to: a node's `name=`, or a `[sub_resource]`'s
   * `id=`. The validator seam never sees the heading, so the scanning loop stamps
   * it and `Linter.convertParseErrors` reads it back. Absent, shown as `<unknown>`,
   * for a malformed heading, the `format=` header and a `.tres`'s `[resource]` body.
   */
  nodeName?: string;
  /** See {@link ParseError.nodeName}. */
  nodeType?: string;

  /**
   * True when the refusal is about the bare `null` itself: the setter opens
   * with `ERR_FAIL_COND(...is_null())`, as `TileSet.sources/<id>` (`add_source`,
   * tile_set.cpp:477) and `TileSet.pattern_<n>` (`add_pattern`, :1359) do.
   * Both are OBJECT slots, where `NIL -> OBJECT` converts and no zero is stored.
   */
  // It rides on the error, like `keyVerdict`: `findValidator` hands the seam a
  // family's dispatcher and `withFiniteGuard` a wrapper, so a validator's tag
  // never arrives.
  nilVerdict?: true;
}

/** Result from the strict parser. */
export interface StrictParseResult {
  errors: ParseError[];
  /**
   * The parsed scene, present whenever the scanner produced one, even when
   * `errors` is non-empty: a bad property value does not invalidate the tree,
   * and the rule phase needs it. Absent only if the scanner could not run.
   */
  scene?: TscnScene;
}

/** Context provided to lint rules during execution. */
export interface RuleContext {
  scene: TscnScene;
  /** The node being validated. */
  node: TscnNode;
  properties: unknown;
}

/**
 * Why a diagnostic that is not about Godot semantics is still worth reporting.
 * A typed category, not free text, as `DeclineCategory` is
 * (`configurationWarningCoverage.test.ts`), so a reader can sort the claims.
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
  /** A `.tscn` a Godot save could not have produced: duplicate names, malformed sections. */
  | 'file-integrity'
  /**
   * A rule threw instead of reporting. About this linter, not the scene, yet an
   * error: the file's findings are incomplete and the run cannot vouch for it.
   */
  | 'linter-failure';

/**
 * Where one reported diagnostic's authority comes from, one grounding per
 * emitted `ruleName`, since one registered rule can report under many. It is
 * required, as `RangeArm.cite` is, so the compiler rejects an ungrounded
 * diagnostic everywhere.
 */
export type EmitGrounding =
  /**
   * A ported `Node::get_configuration_warnings()` row. The `file.cpp:line` is
   * not here: `configurationWarningCoverage.test.ts`'s census holds it, keyed by
   * this `ruleName`, so no second roster can drift from it.
   * `emitsGrounding.test.ts` fails a kind with no census row.
   */
  | { readonly kind: 'configuration-warning' }
  /**
   * An engine rule that is not a configuration warning: a setter that refuses
   * or alters, a `PROPERTY_HINT_RANGE`, `packed_scene.cpp`'s resolution order,
   * a `DISABLE_DEPRECATED` alias. `at` is its `file.cpp:line` in Godot 4.6.3.
   */
  | { readonly kind: 'engine'; readonly at: string }
  /**
   * The engine reads the value, and the read makes the authored value inert: a
   * branch never entered, a mode that never consults the key, a gating flag,
   * such as `sprite_2d.cpp:98`'s `if (region_enabled)`. `at` is that line, and
   * `unused` says in one clause what the value does not do.
   */
  // A separate kind from `engine`: the claim is about reachability, not a
  // bound. Nothing is refused or altered, so it is advisory by construction.
  | { readonly kind: 'engine-inert'; readonly at: string; readonly unused: string }
  /**
   * No engine counterpart: the diagnostic is about the file or this previewer.
   * A condition that is neither engine-grounded nor one of these scopes is an
   * invented rule, and gets deleted (ADR-0032: documentation prose is never a basis).
   */
  | {
      readonly kind: 'no-engine-counterpart';
      readonly scope: OutsideEngineScope;
      readonly because: string;
    };

/**
 * The severity a grounding fixes, or `undefined` where only the cited line can
 * decide: an `engine` arm errors when the setter refuses or alters, and warns
 * for a hint or a load-time `WARN_PRINT`. `emitsGrounding.test.ts` holds every
 * emit to it.
 */
export function severityFixedBy(grounding: EmitGrounding): Severity | undefined {
  // Total over both unions: a new kind or scope fails tsc in a `default` arm
  // instead of returning `undefined`, which callers read as "the cite decides".
  // The arm throws, since the unmatched value is not a `Severity`.
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

export interface RuleMeta {
  /** Unique registry key, for example "no-missing-resource". */
  name: string;
  description: string;
  category: 'validation' | 'performance' | 'best-practice';
  /** Node types this rule applies to (empty = all nodes). */
  applicableNodeTypes?: string[];
  /**
   * When present, decides applicability on its own and overrides
   * `applicableNodeTypes`, so a rule can reach a whole family, such as every
   * `*3D` subclass.
   */
  applicableNodeTypeMatcher?: (nodeType: string) => boolean;
  /**
   * Every `ruleName`/`severity` pair `check` can emit, with its `EmitGrounding`.
   * One rule can report under many `ruleName`s, and each sheet's Linting chapter
   * is generated from this list. `ruleCoverage.test.ts` holds it to the literals
   * in the file, except for factories that interpolate a `ruleName`.
   */
  // Put `severity:` before `ruleName:` in every diagnostic object literal: the
  // coverage guard pairs the two by source order, and it strips `emits` first.
  emits?: ReadonlyArray<{ ruleName: string; severity: Severity; grounding: EmitGrounding }>;
  /**
   * `file:line` of the engine guard that confines this rule to one exact class,
   * as `container.cpp:210`'s `get_class() == "Container"` does. Without it,
   * `ruleCoverage` fails a rule that names a type with descendants. Declared on
   * the rule, as `RangeArm.cite` is, so the guard keeps no parallel roster.
   */
  exactClassByDesign?: string;
}

/** A lint rule that validates `.tscn` nodes. */
export interface LintRule {
  meta: RuleMeta;
  /**
   * Validates a node and returns its diagnostics. `RuleRegistry.getRulesForNodeType`
   * already filtered by `meta`, so a rule must not re-assert its own applicability:
   * a stale second copy cancels a widened meta. Checks on the tree, such as a
   * parent's type, belong here.
   *
   * @param context - The rule execution context
   * @returns Array of diagnostics (empty if no issues found)
   */
  check: (context: RuleContext) => Diagnostic[];
}
