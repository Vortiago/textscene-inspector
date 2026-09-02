/**
 * Shared test-kit for linter slice tests.
 *
 * Collapses the hand-written TSCN fixtures + repeated assert triplets that every
 * `nodes/**\/linter.test.ts` re-implements. The TSCN grammar (the `[gd_scene]`
 * header, node headings, the accept-case CollisionShape child) lives here once;
 * each slice carries only its per-property data (values + message substrings).
 *
 * Build-excluded via the `src/**\/testing/**` tsconfig rule; imports only the
 * React/THREE-free `Linter`, so it stays on the linter side of the boundary.
 *
 * Fidelity contract: property values are rendered VERBATIM when given as strings,
 * so an author keeps full control of the literal form (`Vector2(0, 1)`, `"Master"`,
 * `1e-5`). Rejections assert the diagnostic found *by property name* (or, when an
 * `InvalidCase` sets `ruleName`, by rule name AND property name) plus every
 * required message substring — never a bare count — so coverage matches the
 * longhand tests they replace.
 */

import { describe, it, expect } from 'vitest';
import { Linter } from '../Linter.js';
import type { Diagnostic, Severity } from '../types.js';

/** A property value: rendered verbatim if a string, else `String(value)`. */
export type PropValue = string | number | boolean;

/** Render one `key = value` line. Strings pass through verbatim (the author owns quoting/literals). */
function renderValue(value: PropValue): string {
  return typeof value === 'string' ? value : String(value);
}

export interface NodeOptions {
  /** Node name (irrelevant to validation; defaults to the type). */
  name?: string;
  /** Parent path, e.g. `'.'` for a child of the root node. Omitted = a root node. */
  parent?: string;
}

/** Build one `[node ...]` heading plus its property lines (no trailing blank line). */
export function node(
  type: string,
  props: Record<string, PropValue> = {},
  options: NodeOptions = {}
): string {
  const name = options.name ?? type;
  return heading(`name="${name}" type="${type}"`, props, options);
}

/**
 * A node whose type Godot does not spell: the two headings that carry no
 * `type=` attribute at all.
 *
 * `instanced` is `[node name="X" parent="." instance=ExtResource("id")]` — the
 * type lives in the referenced PackedScene. `override` is
 * `[node name="X" parent="Y" index="0"]` — a property override on a node inside
 * an instance, where the parser's index fallback supplies a type-shaped `"0"`.
 *
 * Both live here because they are the shapes every `*-invalid-parent` rule must
 * stay silent about, and five slice tests were spelling the grammar by hand to
 * say so. A copy that gets an attribute subtly wrong tests nothing and looks
 * like it does.
 */
export function instanced(
  name: string,
  options: NodeOptions & { id?: string } = {}
): string {
  const id = options.id ?? PACKED_SCENE_ID;
  return heading(`name="${name}" instance=ExtResource("${id}")`, {}, options);
}

export function override(name: string, index = 0, options: NodeOptions = {}): string {
  return heading(`name="${name}" index="${index}"`, {}, options);
}

function heading(
  attributes: string,
  props: Record<string, PropValue>,
  options: NodeOptions
): string {
  // `!== undefined`, not truthiness: an EMPTY `parent=""` is a heading Godot
  // reads differently from one carrying no `parent` at all, and a kit that
  // cannot spell it leaves that case untestable.
  const parentAttr = options.parent !== undefined ? ` parent="${options.parent}"` : '';
  const lines = Object.entries(props).map(([key, value]) => `${key} = ${renderValue(value)}`);
  return [`[node ${attributes}${parentAttr}]`, ...lines].join('\n');
}

/**
 * Build one `[sub_resource ...]` heading plus its property lines. Validated
 * through the same `findValidator` as the node half.
 */
export function subResource(
  type: string,
  props: Record<string, PropValue> = {},
  id = 'Res_1'
): string {
  const heading = `[sub_resource type="${type}" id="${id}"]`;
  const lines = Object.entries(props).map(([key, value]) => `${key} = ${renderValue(value)}`);
  return [heading, ...lines].join('\n');
}

/** The canonical accept-case children for physics bodies (a child CollisionShape). */
export const collisionShape2d = node('CollisionShape2D', {}, { parent: '.' });
export const collisionShape3d = node('CollisionShape3D', {}, { parent: '.' });

/** A resolvable `AudioStream` ext_resource block (id `1_abc`) for AudioStreamPlayer scenes. */
export const audioStream = '[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]';

const PACKED_SCENE_ID = '1_body';
/** The `PackedScene` ext_resource {@link instanced} refers to by default. */
export const packedScene = `[ext_resource type="PackedScene" path="res://body.tscn" id="${PACKED_SCENE_ID}"]`;

/** Compose node blocks into a full scene with the `[gd_scene format=3]` header. */
export function scene(...blocks: string[]): string {
  return `[gd_scene format=3]\n\n${blocks.join('\n\n')}\n`;
}

/** Lint content with a fresh Linter (each call is isolated, mirroring `beforeEach`). */
export function lint(content: string): Diagnostic[] {
  return new Linter().lint(content);
}

/** Assert the scene is clean (no diagnostics). */
export function expectClean(content: string): void {
  expect(lint(content)).toHaveLength(0);
}

export interface DiagnosticExpectation {
  /** Find the diagnostic whose message mentions this property name. */
  prop?: string;
  /** Find the diagnostic with this exact rule name. */
  ruleName?: string;
  /** Assert the found diagnostic's severity. */
  severity?: Severity;
  /** Assert the found diagnostic's node type. */
  nodeType?: string;
  /** Assert the found diagnostic's message contains each substring. */
  contains?: string[];
}

/**
 * Every diagnostic `where` could be naming, by the fields that IDENTIFY one.
 *
 * `prop` is a message substring, not a property name — `{ prop: 'resource
 * reference' }` matches the sentence `createResourceReferenceValidator` emits
 * for EVERY resource slot, and `{ prop: 'theme_override_constants' }` matches a
 * whole property family. So this returns the set, and the positive helper below
 * refuses one it cannot narrow to a single member.
 */
function candidates(diagnostics: Diagnostic[], where: DiagnosticExpectation): Diagnostic[] {
  return diagnostics.filter(
    d =>
      (where.ruleName === undefined || d.ruleName === where.ruleName) &&
      (where.prop === undefined || d.message.includes(where.prop))
  );
}

/** The asserted fields: what narrows a family down to the diagnostic under test. */
function matchesAsserted(d: Diagnostic, where: DiagnosticExpectation): boolean {
  return (
    (where.severity === undefined || d.severity === where.severity) &&
    (where.nodeType === undefined || d.nodeType === where.nodeType) &&
    (where.contains ?? []).every(substring => d.message.includes(substring))
  );
}

function describe1(d: Diagnostic): string {
  return `[${d.severity}] ${d.ruleName} (${d.nodeType}): ${d.message}`;
}

/** Why a `where` failed, listing the near-misses so the tier and rule are visible. */
function locateHint(where: DiagnosticExpectation, named: Diagnostic[]): string {
  const asked = JSON.stringify(where);
  if (named.length === 0) return `no diagnostic matches ${asked}`;
  return `${asked} must identify ONE claim; by prop/ruleName there are ${named.length}:\n  ${named.map(describe1).join('\n  ')}`;
}

/**
 * Assert the scene produces exactly one CLAIM matching `where`, and return its
 * diagnostic.
 *
 * One claim, not the first hit: `where` is matched by message substring, so a
 * `{ prop }` naming a shared sentence or a property family answers to several
 * diagnostics at once, and taking the head asserts about whichever one the
 * linter happened to sort first. Narrow with `ruleName`, `severity` or
 * `contains` — those filter the set before it is counted, so disambiguating and
 * asserting are the same act.
 *
 * Distinct MESSAGES, not distinct diagnostics: a rule that reports once per node
 * puts the same sentence in the list twice, and "which of the two" is a question
 * with no wrong answer. Two different sentences is the case where it has one.
 */
export function expectDiagnostic(content: string, where: DiagnosticExpectation): Diagnostic {
  const diagnostics = lint(content);
  expect(diagnostics.length, 'the scene produced no diagnostics at all').toBeGreaterThan(0);
  const named = candidates(diagnostics, where);
  const matched = named.filter(d => matchesAsserted(d, where));
  expect([...new Set(matched.map(d => d.message))], locateHint(where, named)).toHaveLength(1);
  return matched[0]!;
}

/** Assert no diagnostic matching `where` is present (other diagnostics may exist). */
/**
 * The three diagnostics that mean a heading never entered the tree.
 *
 * A NEGATIVE assertion over a scene carrying one proves nothing: Phase 2 walks
 * the tree, so no rule ran on the stranded node and the silence is the fixture's
 * doing rather than the rule's answer. {@link node} omits `parent=` unless asked
 * — which is how a scene's SECOND heading gets stranded without anyone spelling
 * it — and a first heading naming a path resolves against the root's `.`, not
 * against the root's own name.
 *
 * The positive helpers need no such check: they name the diagnostic they expect,
 * and a stranded subject simply fails to produce it.
 */
const STRANDED_RULES = ['node-without-parent', 'unresolved-parent-path', 'root-declares-parent'];

function expectEveryHeadingPlaced(diagnostics: Diagnostic[]): void {
  const stranded = diagnostics
    .filter(d => STRANDED_RULES.includes(d.ruleName))
    .map(d => `${d.ruleName}: ${d.nodeName}`);
  expect(stranded).toEqual([]);
}

export function expectNoDiagnostic(content: string, where: DiagnosticExpectation): void {
  const diagnostics = lint(content);
  expectEveryHeadingPlaced(diagnostics);
  // On the identity fields only. A negative quantifier over a family is the
  // stronger claim, and narrowing it by the asserted fields would turn "no
  // diagnostic for this property" into "none at that tier".
  expect(candidates(diagnostics, where).map(describe1)).toEqual([]);
}

/**
 * Assert the scene produces no *error*-severity diagnostics (warnings tolerated).
 * Optionally narrow to errors mentioning a property (`prop`) or with a given `ruleName`
 * (e.g. `{ ruleName: 'strict-parser' }` for "no strict-parser format errors").
 */
export function expectNoErrors(content: string, where: DiagnosticExpectation = {}): void {
  const diagnostics = lint(content);
  expectEveryHeadingPlaced(diagnostics);
  const errors = diagnostics.filter(
    d =>
      d.severity === 'error' &&
      (where.prop === undefined || d.message.includes(where.prop)) &&
      (where.ruleName === undefined || d.ruleName === where.ruleName)
  );
  expect(errors).toHaveLength(0);
}

/** Assert at least one diagnostic of the given severity is present. */
export function expectSeverity(content: string, severity: Severity): void {
  expect(lint(content).some(d => d.severity === severity)).toBe(true);
}

/** One rejected value plus the message substrings its diagnostic must contain. */
export interface InvalidCase {
  value: PropValue;
  contains?: string[];
  /** Also require the located diagnostic to carry this rule (e.g. `'strict-parser'`). */
  ruleName?: string;
  /**
   * Also require the located diagnostic to carry this severity.
   *
   * ADR-0032's tier is the substance of a bound, not decoration: `enforced`
   * means Godot's setter refuses the value, `hinted` means only the inspector
   * hint does. The two are derived from each other in the DSL, so a flipped
   * tier stays self-consistent and every global guard passes. Naming the
   * expected severity here is what puts the claim in a second file, where an
   * accidental flip has something to break.
   */
  severity?: Severity;
}

/**
 * Assert one invalid case's diagnostic — the whole body of every generated reject `it`.
 * Exported so a test drives it directly and every declared field is proven to still bite.
 */
export function expectInvalidCase(content: string, prop: string, invalid: InvalidCase): Diagnostic {
  return expectDiagnostic(content, {
    prop,
    ruleName: invalid.ruleName,
    contains: invalid.contains,
    severity: invalid.severity,
  });
}

/**
 * How a valid value is asserted:
 * - `'clean'` (default): the scene must produce zero diagnostics.
 * - `'no-error'`: the scene must produce no *error*-severity diagnostics, but may
 *   warn/info — for properties whose valid values legitimately trigger a warning.
 */
export type AcceptMode = 'clean' | 'no-error';

/** A single property's accept/reject table. */
export interface PropertyCase {
  /** The property under test. */
  prop: string;
  /** Values that must satisfy the accept mode. */
  valid?: PropValue[];
  /** Values that must produce a diagnostic mentioning `prop`. */
  invalid?: InvalidCase[];
  /**
   * Extra properties added to the accept-case node so it is otherwise valid.
   *
   * Written ABOVE the property under test. Godot replays a node's properties in
   * file order (packed_scene.cpp:492), so context written below the value it is
   * meant to make legal is not yet in effect — `frame = 3` over a `hframes = 4`
   * beneath it is the refused write Sprite2D's rule reports, not an accept case.
   */
  with?: Record<string, PropValue>;
  /** Override the table-level accept mode for this property. */
  acceptMode?: AcceptMode;
}

export interface PropertyValidationOptions {
  /** The node type whose properties are being validated. */
  nodeType: string;
  /**
   * A child block appended to accept-case scenes so unrelated "needs a child"
   * semantic rules stay quiet — e.g. `collisionShape2d`.
   */
  acceptChild?: string;
  /**
   * Blocks placed before the node under test in EVERY scene (accept and reject) —
   * e.g. a `[sub_resource]` shape plus the parent body a CollisionShape must hang off.
   * Resource blocks belong here (TSCN order), not in `acceptChild`. Don't combine a
   * parentless `prefix` node with `acceptChild`: the child's `parent="."` would bind
   * to the prefix node, not the node under test.
   */
  prefix?: string[];
  /** Heading options for the node under test — e.g. `{ parent: '.' }` to child it under a `prefix` body. */
  nodeOptions?: NodeOptions;
  /** Properties merged into every accept-case node so it is otherwise valid (per-case `with` overrides). */
  baseProps?: Record<string, PropValue>;
  /** Default accept mode for all cases (default `'clean'`; per-case `acceptMode` overrides). */
  acceptMode?: AcceptMode;
}

/**
 * The same accept/reject table, driven through a `[sub_resource]` section.
 *
 * A resource has no place in a scene tree, so there is no parent, child or
 * base-props apparatus: the block is the resource plus a root node, because a
 * scene without one is a different thing to lint. `runPropertyValidation`'s
 * options are deliberately not reused — half of them would be dead.
 */
export function runResourcePropertyValidation(
  resourceType: string,
  cases: PropertyCase[],
  options: {
    acceptMode?: AcceptMode;
    /** Blocks placed before the resource in every scene — the resources its reference cases name. */
    prefix?: string[];
  } = {}
): void {
  const root = node('Node3D', {}, { name: 'Root' });
  const prefix = options.prefix ?? [];
  for (const propCase of cases) {
    const mode = propCase.acceptMode ?? options.acceptMode ?? 'clean';
    describe(`${resourceType}.${propCase.prop} validation`, () => {
      for (const value of propCase.valid ?? []) {
        it(`accepts ${renderValue(value)}`, () => {
          const content = scene(
            ...prefix,
            subResource(resourceType, { ...propCase.with, [propCase.prop]: value }),
            root
          );
          if (mode === 'no-error') expectNoErrors(content);
          else expectClean(content);
        });
      }
      for (const invalid of propCase.invalid ?? []) {
        it(`rejects ${renderValue(invalid.value)}`, () => {
          const content = scene(...prefix, subResource(resourceType, { [propCase.prop]: invalid.value }), root);
          expectInvalidCase(content, propCase.prop, invalid);
        });
      }
    });
  }
}

/**
 * Drive a property accept/reject table through the full Linter.
 *
 * For each case it emits `describe('<prop> validation')` with one `it` per valid
 * value (asserts clean, or no-error per the accept mode) and one `it` per invalid
 * value (asserts the diagnostic found by property name, with its required
 * substrings). Every value and message substring is carried verbatim as data.
 */
export function runPropertyValidation(
  options: PropertyValidationOptions,
  cases: PropertyCase[]
): void {
  const { nodeType, acceptChild, prefix = [], nodeOptions = {}, baseProps } = options;
  for (const propCase of cases) {
    const mode = propCase.acceptMode ?? options.acceptMode ?? 'clean';
    describe(`${propCase.prop} validation`, () => {
      for (const value of propCase.valid ?? []) {
        it(`accepts ${renderValue(value)}`, () => {
          const underTest = node(
            nodeType,
            { ...baseProps, ...propCase.with, [propCase.prop]: value },
            nodeOptions
          );
          const content = scene(...prefix, underTest, ...(acceptChild ? [acceptChild] : []));
          if (mode === 'no-error') expectNoErrors(content);
          else expectClean(content);
        });
      }
      for (const invalid of propCase.invalid ?? []) {
        it(`rejects ${renderValue(invalid.value)}`, () => {
          const underTest = node(nodeType, { [propCase.prop]: invalid.value }, nodeOptions);
          expectInvalidCase(scene(...prefix, underTest), propCase.prop, invalid);
        });
      }
    });
  }
}
