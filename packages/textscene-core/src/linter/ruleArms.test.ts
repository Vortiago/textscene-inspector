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
    // The conditional spread that omits an arm is the ONLY gate; `emits` cannot
    // disagree with `check` about it because both read this same record.
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
    // The silence is the fix: an undeclared arm reported anyway is exactly the
    // divergence no emits guard can see.
    const into: Diagnostic[] = [];
    reportArm(into, undefined, node, 'the mask is zero');
    expect(into).toEqual([]);
  });
});

/**
 * Every arm a factory declares must have a report site in the same file.
 *
 * This is the direction `ruleCoverage.emits.test.ts` loses for the `armEmits`
 * form. Its "declares no ruleName its own code cannot emit" test reads the
 * names back off the source, and an arm table spells them where `stripEmits`
 * does not reach — so the name is scraped as reachable whether or not anything
 * reports it. Measured: deleting the `concaveShape` report site left all 26 of
 * those assertions green.
 *
 * Keyed on the table's own binding rather than the identifier `arms`, and
 * floored, because a guard that matches no file passes.
 */
const DECLARATION = /const\s+([A-Za-z_$][\w$]*)\s*:\s*RuleArms<[^>]*>\s*=\s*\{/g;

interface ArmTable {
  readonly file: string;
  readonly binding: string;
  readonly keys: string[];
}

function armTables(): ArmTable[] {
  const tables: ArmTable[] = [];
  for (const file of allSourceFiles()) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const match of src.matchAll(DECLARATION)) {
      const open = match.index + match[0].length - 1;
      const keys = topLevelParts(balancedGroup(src, open))
        .map((part) => /^\s*([A-Za-z_$][\w$]*)\s*:/.exec(part)?.[1])
        .filter((key) => key !== undefined);
      tables.push({ file, binding: match[1]!, keys });
    }
  }
  return atLeast(tables, 4, 'armTables');
}

describe('an arm table', () => {
  it('reports every arm it declares', () => {
    const unreported: string[] = [];
    for (const { file, binding, keys } of armTables()) {
      const src = stripComments(readFileSync(file, 'utf8'));
      for (const key of keys) {
        // The two call shapes the facility offers: the direct `reportArm`, and
        // the one-line closure over it each factory opens. A THIRD shape is a
        // failure here rather than a silent pass — the guard cannot vouch for a
        // reference it does not recognise.
        const site = new RegExp(
          String.raw`\breport\(\s*${binding}\.${key}\b|\breportArm\(\s*\w+\s*,\s*${binding}\.${key}\b`
        );
        if (!site.test(src)) unreported.push(`${file.slice(srcRoot.length + 1)}: ${binding}.${key}`);
      }
    }
    expect(unreported.sort()).toEqual([]);
  });
});
