/**
 * Every range-advisory threshold cites a real Godot source location. The
 * compiler already requires `RangeArm.cite`, so this reads the sources for each
 * `cite: '…'` literal: a runtime registry would re-register per lint for a table
 * a shared helper builds inside `check()`.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { stripComments } from '@textscene/dev-kit';
import { join } from 'node:path';
import { rangeAdvisories, type RangeAdvisoryTable } from './rangeAdvisory.js';
import type { TscnNode } from '../parser/types.js';
import { ENGINE_CITE_RE } from './testing/engineCite.js';


/**
 * Every `cite: '…'` literal in the sources, with its file. A cite passed to an
 * arm-builder as a parameter hides from it, so `lights/shared/linterChecks.ts`
 * keeps `omniRangeArms` and `spotRangeArms` apart, one literal each.
 */
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
    // A scrape that matches nothing passes every assertion below it, so the
    // floor sits near the real count: a broken regex, a moved directory or
    // double-quoted cites fail here.
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
