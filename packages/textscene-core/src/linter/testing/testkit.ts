/**
 * Shared test kit for linter slice tests: the TSCN grammar lives here once, and
 * each slice carries only its per-property data. It imports only the React- and
 * THREE-free `Linter`, and `src/**\/testing/**` keeps it out of the build.
 */

// String values render verbatim, so the author owns the literal form. A
// rejection finds its diagnostic by property name, and by rule name when an
// `InvalidCase` sets one, plus every required substring, never a bare count.
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
  /** Parent path, such as `'.'` for a child of the root node. Omitted, a root node. */
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
 * A heading with no `type=`, whose type lives in the referenced PackedScene:
 * `[node name="X" parent="." instance=ExtResource("id")]`. It and
 * {@link override} are shapes every `*-invalid-parent` rule stays silent about,
 * and a hand copy with a wrong attribute tests nothing.
 */
export function instanced(
  name: string,
  options: NodeOptions & { id?: string } = {}
): string {
  const id = options.id ?? PACKED_SCENE_ID;
  return heading(`name="${name}" instance=ExtResource("${id}")`, {}, options);
}

/**
 * `[node name="X" parent="Y" index="0"]`: a property override on a node inside an
 * instance, where the parser's index fallback supplies a type-shaped `"0"`.
 */
export function override(name: string, index = 0, options: NodeOptions = {}): string {
  return heading(`name="${name}" index="${index}"`, {}, options);
}

function heading(
  attributes: string,
  props: Record<string, PropValue>,
  options: NodeOptions
): string {
  // `!== undefined`, not truthiness: Godot reads an empty `parent=""`
  // differently from no `parent` at all.
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
 * Every diagnostic `where` could be naming, by the fields that identify one.
 * `prop` is a message substring, which can match every resource slot or a whole
 * property family, so this returns the set for the caller to narrow.
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
 * Assert the scene produces exactly one claim matching `where`, not the first
 * hit, and return its diagnostic. `ruleName`, `severity` and `contains` narrow
 * the set before it is counted. It counts distinct messages, since a rule that
 * reports once per node repeats the same sentence.
 */
export function expectDiagnostic(content: string, where: DiagnosticExpectation): Diagnostic {
  const diagnostics = lint(content);
  expect(diagnostics.length, 'the scene produced no diagnostics at all').toBeGreaterThan(0);
  const named = candidates(diagnostics, where);
  const matched = named.filter(d => matchesAsserted(d, where));
  expect([...new Set(matched.map(d => d.message))], locateHint(where, named)).toHaveLength(1);
  return matched[0]!;
}

/**
 * The diagnostics that mean a heading never entered the tree. A negative
 * assertion over one proves nothing, since phase 2 runs no rule on a stranded
 * node. {@link node} omits `parent=` unless asked, which strands a second
 * heading, and a first heading's path resolves against `.`, not the root's name.
 */
const STRANDED_RULES = [
  'node-without-parent',
  'unresolved-parent-path',
  'empty-parent-path',
  'root-declares-parent',
];

function expectEveryHeadingPlaced(diagnostics: Diagnostic[]): void {
  const stranded = diagnostics
    .filter(d => STRANDED_RULES.includes(d.ruleName))
    .map(d => `${d.ruleName}: ${d.nodeName}`);
  expect(stranded).toEqual([]);
}

/** Assert no diagnostic matching `where` is present (other diagnostics may exist). */
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
 * Optionally narrow to errors mentioning a property (`prop`) or with a given `ruleName`,
 * such as `{ ruleName: 'strict-parser' }` for "no strict-parser format errors".
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
  /** Also require the located diagnostic to carry this rule, such as `'strict-parser'`. */
  ruleName?: string;
  /**
   * Also require the located diagnostic to carry this severity. The DSL derives
   * the tier from `enforced` or `hinted` (ADR-0032), so a flipped tier passes
   * every global guard, and only this second statement of it can break.
   */
  severity?: Severity;
}

/**
 * Assert one invalid case's diagnostic: the whole body of every generated reject `it`.
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
 *   warn or info, for properties whose valid values legitimately trigger a warning.
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
   * Extra properties added to the accept-case node so it is otherwise valid,
   * written above the property under test: Godot replays properties in file
   * order (packed_scene.cpp:492), so `frame = 3` above `hframes = 4` is refused.
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
   * semantic rules stay quiet, such as `collisionShape2d`.
   */
  acceptChild?: string;
  /**
   * Blocks placed before the node under test in every scene, such as a
   * `[sub_resource]` shape and the parent body a CollisionShape hangs off. Do not
   * combine a parentless `prefix` node with `acceptChild`: the child's
   * `parent="."` binds to the prefix node, not the node under test.
   */
  prefix?: string[];
  /** Heading options for the node under test, such as `{ parent: '.' }` to child it under a `prefix` body. */
  nodeOptions?: NodeOptions;
  /** Properties merged into every accept-case node so it is otherwise valid (per-case `with` overrides). */
  baseProps?: Record<string, PropValue>;
  /** Default accept mode for all cases (default `'clean'`; per-case `acceptMode` overrides). */
  acceptMode?: AcceptMode;
}

/**
 * The same accept/reject table, driven through a `[sub_resource]` section plus a
 * root node, since a scene without one lints differently. A resource has no
 * place in the tree, so `runPropertyValidation`'s parent and child options stay out.
 */
export function runResourcePropertyValidation(
  resourceType: string,
  cases: PropertyCase[],
  options: {
    acceptMode?: AcceptMode;
    /** Blocks placed before the resource in every scene: the resources its reference cases name. */
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
 * Drive a property accept/reject table through the full Linter: one
 * `describe('<prop> validation')` per case, with an `it` per valid value (clean,
 * or no-error per the accept mode) and per invalid value (its diagnostic).
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
