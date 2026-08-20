/**
 * Every range-advisory threshold must cite the Godot line that states it.
 *
 * `boundGrounding.test.ts` sweeps validators. An advisory arm is the same kind
 * of claim about the same kind of value, made one layer up in a semantic rule,
 * and it was outside that sweep: a threshold could be invented here while the
 * bound ratchet read zero. Both `Camera2D.zoom` bounds were once wrong in
 * exactly this way, the validator copy and the rule copy independently.
 *
 * `RangeArm.cite` being required is what gives this complete coverage: the
 * compiler rejects an arm without one, everywhere, with no sweep needed. What a
 * type cannot check is whether the string names a real source location rather
 * than restating the rule's own opinion, so that is what this file checks, by
 * reading the sources instead of the live objects. A runtime registry would
 * need every table wrapped in a register call, and a table built from a shared
 * helper is constructed inside `check()` — it would re-register per lint.
 *
 * Known edge: the scrape sees `cite: '…'` literals, so a shared arm-builder
 * taking the citation as a PARAMETER hides its value from this check. The
 * compiler still demands a cite, so nothing goes uncited; only its plausibility
 * escapes. `lights/shared/linterChecks.ts` is split into `omniRangeArms` and
 * `spotRangeArms` for exactly this reason — two `ADD_PROPERTY` lines, two
 * literals — rather than one helper taking a `cite` argument.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { stripComments } from '@textscene/dev-kit';
import { join } from 'node:path';
import { rangeAdvisories, type RangeAdvisoryTable } from './rangeAdvisory.js';
import type { TscnNode } from '../parser/types.js';
import { ENGINE_CITE_RE } from './testing/engineCite.js';


/** Every `cite: '…'` literal in the sources, with the file it came from. */
function citeLiterals(): { file: string; cite: string }[] {
  const root = join(import.meta.dirname, '..');
  const out: { file: string; cite: string }[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.endsWith('.ts') || entry.endsWith('.test.ts')) continue;
      const source = stripComments(readFileSync(path, 'utf8'));
      for (const match of source.matchAll(/\bcite:\s*'([^']*)'/g)) {
        out.push({ file: path.slice(root.length + 1), cite: match[1]! });
      }
    }
  };

  walk(root);
  return out;
}

function node(properties: Record<string, string>): TscnNode {
  return { name: 'N', type: 'T', properties } as unknown as TscnNode;
}

describe('range advisory grounding', () => {
  it('finds the arms it is meant to be checking', () => {
    // A scrape that silently matches nothing passes every assertion below it,
    // so the floor is near the real count (65) rather than at 1: a broken
    // regex, a moved directory, or a subtree that switches to double-quoted
    // cites has to fail here rather than shrink the subject list in silence.
    expect(citeLiterals().length).toBeGreaterThan(55);
  });

  it('cites a real source location on every arm', () => {
    const uncited = citeLiterals()
      .filter(({ cite }) => !ENGINE_CITE_RE.test(cite))
      .map(({ file, cite }) => `${file}: "${cite}"`);
    expect(uncited.sort()).toEqual([]);
  });

  it('emits a warning, never an error, whatever the citation says', () => {
    // ADR-0032: a hint constrains the inspector widget, not the engine. An arm
    // grounded in an ERR_FAIL belongs in a validator as an error instead.
    const table: RangeAdvisoryTable = {
      range: [{ over: 1, ruleName: 'r', message: () => 'm', cite: 'light_3d.cpp:389' }],
    };
    expect(rangeAdvisories(node({ range: '5' }), table)[0]?.severity).toBe('warning');
  });

  it('still trips the arm it cites', () => {
    const table: RangeAdvisoryTable = {
      range: [{ over: 100, ruleName: 'r', message: (v) => `${v}`, cite: 'light_3d.cpp:389' }],
    };
    expect(rangeAdvisories(node({ range: '200' }), table)).toHaveLength(1);
    expect(rangeAdvisories(node({ range: '50' }), table)).toHaveLength(0);
  });
});
