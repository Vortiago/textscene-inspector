/**
 * The contract that makes a factory's two halves one declaration.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { escapeRegExp, stripComments } from '@textscene/dev-kit';
import { armEmits, groundedArm, reportArm, type RuleArm, type RuleArms } from './ruleArms.js';
import { allSourceFiles, atLeast, srcLabel } from './testing/ruleNameScrape.js';
import { balancedGroup, topLevelParts } from './testing/bracketScan.js';
import type { Diagnostic } from './types.js';
import type { TscnNode } from '../parser/types.js';

const node: TscnNode = { rawProperties: {}, name: 'Cast', type: 'ShapeCast2D', properties: {}, children: [] };

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

describe('groundedArm', () => {
  it('takes the severity a configuration warning fixes', () => {
    expect(groundedArm('x-y', { kind: 'configuration-warning' })).toEqual({
      severity: 'warning',
      ruleName: 'x-y',
      grounding: { kind: 'configuration-warning' },
    });
  });

  it('takes the severity an inert value fixes', () => {
    const arm = groundedArm('x-y', { kind: 'engine-inert', at: 'a.cpp:1', unused: 'nothing reads it' });
    expect(arm).toBeAtTier('info');
  });

  it('takes the severity a scope outside the engine fixes', () => {
    const arm = groundedArm('x-y', {
      kind: 'no-engine-counterpart',
      scope: 'linter-failure',
      because: 'it threw',
    });
    expect(arm).toBeAtTier('error');
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
 * Every arm a table declares is used, because `armEmits` lists each arm whether
 * or not `check` reaches it. The test finds a table by the type it claims,
 * annotation or `satisfies`, with or without `as const`: matching one spelling
 * leaves the others unguarded.
 */
const OBJECT_LITERAL = /(export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::([^=]*?))?=\s*\{/g;
/** The contract, in either place TypeScript lets it be stated. */
const ARM_CONTRACT = /RuleArms<|Record<\s*string\s*,\s*RuleArm\s*>/;
const SATISFIES_TAIL = /^\s*(?:as\s+const\s+)?satisfies\s+([^;]*)/;

interface ArmTable {
  readonly file: string;
  readonly binding: string;
  readonly exported: boolean;
  readonly keys: string[];
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
  return atLeast(tables, 110, 'armTables');
}

describe('an arm table', () => {
  it('uses every arm it declares', () => {
    const unused: string[] = [];
    // A private table is used in its own file, an exported one anywhere
    // (`FILE_DIAGNOSTICS`). Any reference counts: a report call, a helper's
    // argument or a row of a table that `check` loops over.
    for (const { file, binding, exported, keys } of armTables()) {
      const scope = exported ? allSourceFiles() : [file];
      for (const key of keys) {
        const ref = new RegExp(String.raw`\b${escapeRegExp(binding)}\.${escapeRegExp(key)}\b`);
        if (!scope.some((f) => ref.test(sourceOf(f)))) unused.push(`${srcLabel(file)}: ${binding}.${key}`);
      }
    }
    expect(unused.sort()).toEqual([]);
  });
});
