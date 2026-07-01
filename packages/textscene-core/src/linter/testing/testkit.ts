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
 * `1e-5`). Rejections assert the diagnostic found *by property name* plus every
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
  const parentAttr = options.parent ? ` parent="${options.parent}"` : '';
  const heading = `[node name="${name}" type="${type}"${parentAttr}]`;
  const lines = Object.entries(props).map(([key, value]) => `${key} = ${renderValue(value)}`);
  return [heading, ...lines].join('\n');
}

/** The canonical accept-case children for physics bodies (a child CollisionShape). */
export const collisionShape2d = node('CollisionShape2D', {}, { parent: '.' });
export const collisionShape3d = node('CollisionShape3D', {}, { parent: '.' });

/** A resolvable `AudioStream` ext_resource block (id `1_abc`) for AudioStreamPlayer scenes. */
export const audioStream = '[ext_resource type="AudioStream" path="res://sound.ogg" id="1_abc"]';

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

function locate(diagnostics: Diagnostic[], where: DiagnosticExpectation): Diagnostic | undefined {
  if (where.ruleName !== undefined) return diagnostics.find(d => d.ruleName === where.ruleName);
  if (where.prop !== undefined) return diagnostics.find(d => d.message.includes(where.prop!));
  return diagnostics[0];
}

/**
 * Assert the scene produces a diagnostic matching `where`, and return it.
 * Replaces the `length>0` + `find(...)` + `toBeDefined` + `toContain(...)` triplet.
 */
export function expectDiagnostic(content: string, where: DiagnosticExpectation): Diagnostic {
  const diagnostics = lint(content);
  expect(diagnostics.length).toBeGreaterThan(0);
  const found = locate(diagnostics, where);
  expect(found).toBeDefined();
  if (where.severity !== undefined) expect(found?.severity).toBe(where.severity);
  if (where.nodeType !== undefined) expect(found?.nodeType).toBe(where.nodeType);
  for (const substring of where.contains ?? []) {
    expect(found?.message).toContain(substring);
  }
  return found as Diagnostic;
}

/** Assert no diagnostic matching `where` is present (other diagnostics may exist). */
export function expectNoDiagnostic(content: string, where: DiagnosticExpectation): void {
  expect(locate(lint(content), where)).toBeUndefined();
}

/**
 * Assert the scene produces no *error*-severity diagnostics (warnings/info tolerated).
 * Optionally narrow to errors mentioning a property (`prop`) or with a given `ruleName`
 * (e.g. `{ ruleName: 'strict-parser' }` for "no strict-parser format errors").
 */
export function expectNoErrors(content: string, where: DiagnosticExpectation = {}): void {
  const errors = lint(content).filter(
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
  /** Extra properties added to the accept-case node so it is otherwise valid. */
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
  /** Properties merged into every accept-case node so it is otherwise valid (per-case `with` overrides). */
  baseProps?: Record<string, PropValue>;
  /** Default accept mode for all cases (default `'clean'`; per-case `acceptMode` overrides). */
  acceptMode?: AcceptMode;
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
  const { nodeType, acceptChild, baseProps } = options;
  for (const propCase of cases) {
    const mode = propCase.acceptMode ?? options.acceptMode ?? 'clean';
    describe(`${propCase.prop} validation`, () => {
      for (const value of propCase.valid ?? []) {
        it(`accepts ${renderValue(value)}`, () => {
          const underTest = node(nodeType, { ...baseProps, [propCase.prop]: value, ...propCase.with });
          const content = acceptChild ? scene(underTest, acceptChild) : scene(underTest);
          if (mode === 'no-error') expectNoErrors(content);
          else expectClean(content);
        });
      }
      for (const invalid of propCase.invalid ?? []) {
        it(`rejects ${renderValue(invalid.value)}`, () => {
          expectDiagnostic(scene(node(nodeType, { [propCase.prop]: invalid.value })), {
            prop: propCase.prop,
            contains: invalid.contains,
          });
        });
      }
    });
  }
}
