/**
 * The contract that makes a factory's two halves one declaration.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { stripComments } from '@textscene/dev-kit';
import { armEmits, reportArm, type RuleArm, type RuleArms } from './ruleArms.js';
import { allSourceFiles, atLeast, srcRoot } from './testing/ruleNameScrape.js';
import { balancedGroup, topLevelParts } from './testing/emitsReach.js';
import type { Diagnostic } from './types.js';
import type { TscnNode } from '../parser/types.js';

const node: TscnNode = { name: 'Cast', type: 'ShapeCast2D', properties: {}, children: [] };

const present: RuleArm = {
  severity: 'warning',
  ruleName: 'shapecast2d-zero-mask',
  grounding: { kind: 'engine-inert', at: 'godot_space_2d.cpp:44', unused: 'nothing matches' },
};

describe('armEmits', () => {
  it('declares every arm the instance carries, in declaration order', () => {
    const arms: RuleArms<'a' | 'b'> = { a: present, b: { ...present, ruleName: 'second' } };
    expect(armEmits(arms).map((e) => e.ruleName)).toEqual(['shapecast2d-zero-mask', 'second']);
  });

  it('declares nothing for an arm this instance does not carry', () => {
    // The conditional spread that omits an arm is the only gate. `emits` cannot
    // disagree with `check` about it, because both read this same record.
    const arms: RuleArms<'a' | 'b'> = { a: present };
    expect(armEmits(arms).map((e) => e.ruleName)).toEqual(['shapecast2d-zero-mask']);
  });
});

describe('reportArm', () => {
  it('reports the arm at its declared severity and name', () => {
    const into: Diagnostic[] = [];
    reportArm(into, present, node, 'the mask is zero');
    expect(into).toEqual([
      {
        severity: 'warning',
        message: 'the mask is zero',
        nodeName: 'Cast',
        nodeType: 'ShapeCast2D',
        ruleName: 'shapecast2d-zero-mask',
      },
    ]);
  });

  it('says nothing for an arm this instance does not carry', () => {
    // An undeclared arm reported anyway is the divergence no emits guard can
    // see.
    const into: Diagnostic[] = [];
    reportArm(into, undefined, node, 'the mask is zero');
    expect(into).toEqual([]);
  });
});

/**
 * Every arm a table declares is reported somewhere. `ruleCoverage.emits.test.ts`
 * misses this for `armEmits`, since `stripEmits` does not reach an arm table.
 * A table is found by the type it claims, annotation or `satisfies`, with or
 * without `as const`: matching one spelling leaves the others unguarded.
 */
const OBJECT_LITERAL = /(export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::([^=]*?))?=\s*\{/g;
/** The contract, in either place TypeScript lets it be stated. */
const ARM_CONTRACT = /RuleArms<|Record<\s*string\s*,\s*RuleArm\s*>/;
const SATISFIES_TAIL = /^\s*(?:as\s+const\s+)?satisfies\s+([^;]*)/;
const REPORT_CALL = /\b(?:report|reportArm|armDiagnostic)\s*\(/g;

interface ArmTable {
  readonly file: string;
  readonly binding: string;
  readonly exported: boolean;
  readonly keys: string[];
}

/** `binding` and `key` reach a RegExp, and both grammars admit `$`. */
function escapeRe(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function keysIn(body: string): string[] {
  return topLevelParts(body)
    .map((part) => /^\s*([A-Za-z_$][\w$]*)\s*:/.exec(part)?.[1])
    .filter((key) => key !== undefined);
}

const stripped = new Map<string, string>();
function sourceOf(file: string): string {
  let src = stripped.get(file);
  if (src === undefined) stripped.set(file, (src = stripComments(readFileSync(file, 'utf8'))));
  return src;
}

/** Every argument list handed to a report call in `file`. */
const callArgs = new Map<string, string[]>();
function reportCallArgs(file: string): string[] {
  let args = callArgs.get(file);
  if (args === undefined) {
    const src = sourceOf(file);
    args = [...src.matchAll(REPORT_CALL)].map((m) =>
      balancedGroup(src, m.index + m[0].length - 1)
    );
    callArgs.set(file, args);
  }
  return args;
}

function armTables(): ArmTable[] {
  const tables: ArmTable[] = [];
  for (const file of allSourceFiles()) {
    const src = sourceOf(file);
    for (const match of src.matchAll(OBJECT_LITERAL)) {
      const open = match.index + match[0].length - 1;
      const body = balancedGroup(src, open);
      const annotation = match[3] ?? '';
      const tail = SATISFIES_TAIL.exec(src.slice(open + body.length + 2))?.[1] ?? '';
      if (!ARM_CONTRACT.test(annotation) && !ARM_CONTRACT.test(tail)) continue;
      tables.push({ file, binding: match[2]!, exported: match[1] !== undefined, keys: keysIn(body) });
    }
  }
  return atLeast(tables, 6, 'armTables');
}

describe('an arm table', () => {
  it('reports every arm it declares', () => {
    const unreported: string[] = [];
    // A private table is reported in its own file, an exported one anywhere
    // (`FILE_DIAGNOSTICS`). The reference may sit anywhere in the argument
    // list, since one call can pick its arm with a ternary.
    for (const { file, binding, exported, keys } of armTables()) {
      const scope = exported ? allSourceFiles() : [file];
      for (const key of keys) {
        const ref = new RegExp(String.raw`\b${escapeRe(binding)}\.${escapeRe(key)}\b`);
        const reported = scope.some((f) => reportCallArgs(f).some((args) => ref.test(args)));
        if (!reported) unreported.push(`${file.slice(srcRoot.length + 1)}: ${binding}.${key}`);
      }
    }
    expect(unreported.sort()).toEqual([]);
  });
});
