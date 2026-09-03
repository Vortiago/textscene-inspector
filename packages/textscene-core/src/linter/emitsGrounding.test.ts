/**
 * Every diagnostic a semantic rule reports must say where its authority is.
 *
 * `boundGrounding.test.ts` does this for validators and `rangeAdvisoryGrounding`
 * for advisory arms. A `LintRule`'s `check()` was the remaining hole: it is free
 * code, so a hand-rolled condition with no engine counterpart looked exactly
 * like a ported `get_configuration_warnings()` row, and the only way to tell
 * them apart was to read all 118 corpus diagnostics by hand. That audit found
 * nine with no counterpart at all.
 *
 * `RuleMeta.emits` now carries an `EmitGrounding` per entry, and it is REQUIRED
 * - the same move `RangeArm.cite` makes. The compiler rejects an ungrounded
 * diagnostic at every site, so there is no sweep to keep complete and no budget
 * number to ratchet down. What a type cannot check is whether the claim is
 * true, and that is this file:
 *
 *   - a `configuration-warning` arm names a rule the census actually holds a
 *     row for, so the `file.cpp:line` is stated once and cannot drift;
 *   - an `engine` arm cites a real source location, and is NOT quietly
 *     re-typing a citation the census already holds;
 *   - a `no-engine-counterpart` arm gives a reason, since its whole claim is
 *     that no engine line exists to cite.
 */

import { describe, it, expect } from 'vitest';
import { ruleRegistry } from './RuleRegistry.js';
import { WARNINGS } from './configurationWarningCensus.js';
import { FILE_DIAGNOSTICS } from './fileDiagnostics.js';
import { severityFixedBy, type EmitGrounding, type Severity } from './types.js';
import './index.js'; // side-effect: every slice registers its rules
import { ENGINE_CITE_RE } from './testing/engineCite.js';

/** Every emitted `ruleName` a census row claims, with the row's `file.cpp:line`. */
function censusCitations(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const rows of Object.values(WARNINGS)) {
    for (const row of rows) {
      if (!('rule' in row.verdict)) continue;
      const list = out.get(row.verdict.rule) ?? [];
      list.push(row.at);
      out.set(row.verdict.rule, list);
    }
  }
  return out;
}

interface Entry {
  readonly rule: string;
  readonly ruleName: string;
  readonly severity: Severity;
  readonly grounding: EmitGrounding;
}

/**
 * Every emits entry in the live registry, tagged with the rule declaring it —
 * plus the file-level diagnostics, which no rule can own.
 *
 * `Linter` stamps those directly, so they reach no `RuleMeta.emits` and would
 * otherwise be the one place a citation lives in a prose comment and nothing
 * checks it. They carry the same shape, so they sweep with everything else.
 */
function entries(): Entry[] {
  return [
    ...ruleRegistry
      .getRules()
      .flatMap((r) => (r.meta.emits ?? []).map((e) => ({ rule: r.meta.name, ...e }))),
    ...Object.values(FILE_DIAGNOSTICS).map((d) => ({ rule: 'Linter', ...d })),
  ];
}

/**
 * The `file.cpp:line` behind one entry, or a reason there is none.
 *
 * This is the resolution the census-lookup design exists for: a ported warning
 * carries no citation of its own, and reading it here is what proves the row it
 * points at is real.
 */
function resolve(entry: Entry, census: Map<string, string[]>): string {
  switch (entry.grounding.kind) {
    case 'engine':
      return entry.grounding.at;
    case 'engine-inert':
      return `${entry.grounding.at} ${entry.grounding.unused}`;
    case 'configuration-warning':
      return (census.get(entry.ruleName) ?? []).join(' ');
    case 'no-engine-counterpart':
      return entry.grounding.because;
  }
}

describe('emit grounding', () => {
  const census = censusCitations();
  const all = entries();

  it('sweeps the whole registry, not an empty set', () => {
    // A guard that silently matches nothing passes everything below it. The
    // floor sits just under the real population (246 at the time of writing),
    // so a failed barrel import or an emptied registry fails HERE.
    expect(all.length).toBeGreaterThan(200);
    expect(new Set(all.map((e) => e.rule)).size).toBeGreaterThan(100);
  });

  it('resolves every ported configuration warning to a census row', () => {
    // The citation lives in the census and nowhere else, so an arm pointing at
    // a row that does not exist is an unbacked claim, not a typo in a string.
    const unresolved = all
      .filter((e) => e.grounding.kind === 'configuration-warning' && !census.has(e.ruleName))
      .map((e) => `${e.rule}: ${e.ruleName}`);
    expect([...new Set(unresolved)].sort()).toEqual([]);
  });

  it('cites a real source location on every engine arm', () => {
    const uncited = all
      .filter(
        (e) =>
          (e.grounding.kind === 'engine' || e.grounding.kind === 'engine-inert') &&
          !ENGINE_CITE_RE.test(e.grounding.at)
      )
      .map((e) => `${e.rule}: ${e.ruleName}`);
    expect(uncited.sort()).toEqual([]);
  });

  it('says what an engine-inert value does not do', () => {
    // Without the clause the arm degrades into "there is a line somewhere near
    // this", which is the unfalsifiable claim `engine` already covers. The
    // clause is what a reader checks the citation against.
    const unexplained = all
      .filter((e) => e.grounding.kind === 'engine-inert' && !e.grounding.unused.trim())
      .map((e) => `${e.rule}: ${e.ruleName}`);
    expect(unexplained.sort()).toEqual([]);
  });

  it('reports at the severity its grounding fixes', () => {
    // The tier is derived, not chosen: a ported editor warning warns, a value
    // the engine never reads informs, a limitation of this previewer informs,
    // a linter failure errs. Only an `engine` arm is left to its cite, since
    // a refusal and a hint sit on the same kind.
    const offTier = all
      .filter((e) => {
        const fixed = severityFixedBy(e.grounding);
        return fixed !== undefined && fixed !== e.severity;
      })
      .map((e) => `${e.rule}: ${e.ruleName} is ${e.severity}, its grounding fixes ${severityFixedBy(e.grounding)}`);
    expect(offTier.sort()).toEqual([]);
  });

  it('keeps the census the only place a ported warning is cited', () => {
    // An `engine` arm on a ruleName the census already holds is the second
    // roster this design exists to prevent: two `file.cpp:line`s for one
    // condition, free to disagree after a Godot bump.
    const duplicated = all
      .filter((e) => e.grounding.kind !== 'configuration-warning' && census.has(e.ruleName))
      .map((e) => `${e.rule}: ${e.ruleName} (${e.grounding.kind})`);
    expect([...new Set(duplicated)].sort()).toEqual([]);
  });

  it('keeps the census the only place a ported LINE is cited, too', () => {
    // The name check above misses the subtler duplication: two rule names for
    // one `warnings.push_back`, one resolving through the census and the other
    // re-typing its `file.cpp:line`. `collisionshape2d-no-parent` and
    // `collisionshape2d-invalid-parent` are the same push at
    // `collision_shape_2d.cpp:176`. The fix is a census ROW for the second name
    // (the PathFollow parentless pair is the precedent), never a second cite.
    const censusLines = new Set([...census.values()].flat());
    const reCited = all
      .filter(
        (e) =>
          (e.grounding.kind === 'engine' || e.grounding.kind === 'engine-inert') &&
          censusLines.has(e.grounding.at)
      )
      .map((e) => `${e.rule}: ${e.ruleName} re-cites ${(e.grounding as { at: string }).at}`);
    expect([...new Set(reCited)].sort()).toEqual([]);
  });

  it('gives every no-engine-counterpart arm a reason', () => {
    const unreasoned = all
      .filter((e) => e.grounding.kind === 'no-engine-counterpart' && !e.grounding.because.trim())
      .map((e) => `${e.rule}: ${e.ruleName}`);
    expect(unreasoned.sort()).toEqual([]);
  });

  it('resolves a citation or a reason for every entry, with none left blank', () => {
    const blank = all.filter((e) => !resolve(e, census).trim()).map((e) => e.ruleName);
    expect([...new Set(blank)].sort()).toEqual([]);
  });

  it('holds the census rows themselves to the same citation format', () => {
    // The lookup is only worth doing while the thing looked up is a real line;
    // a row whose `at` had degraded to prose would launder every arm resolving
    // through it.
    const malformed = [...census]
      .flatMap(([rule, ats]) => ats.filter((at) => !ENGINE_CITE_RE.test(at)).map((at) => `${rule}: ${at}`))
      .sort();
    expect(malformed).toEqual([]);
  });

  it('writes no bracket into an emits string, which would break the emits scrape', () => {
    // `ruleCoverage.test.ts` finds the end of an `emits: [ … ]` array by
    // counting brackets. A `[` or `]` inside a `because:` desyncs that count and
    // silently deletes real diagnostics from its scrape - the guard would then
    // pass because it can no longer see what it checks.
    const bracketed = all
      .filter((e) => /[[\]]/.test(resolve(e, census)) || /[[\]]/.test(e.ruleName))
      .map((e) => `${e.rule}: ${e.ruleName}`);
    expect(bracketed.sort()).toEqual([]);
  });
});

describe('the grounding guard bites', () => {
  const census = new Map<string, string[]>([['ported-thing', ['some_node.cpp:12']]]);
  const entry = (grounding: EmitGrounding, ruleName = 'x-y'): Entry => ({
    rule: 'valid-x',
    ruleName,
    severity: 'warning',
    grounding,
  });

  it('resolves a ported warning through the census, not through the rule', () => {
    expect(resolve(entry({ kind: 'configuration-warning' }, 'ported-thing'), census)).toBe(
      'some_node.cpp:12'
    );
  });

  it('resolves a ported warning with no row to nothing at all', () => {
    expect(resolve(entry({ kind: 'configuration-warning' }), census)).toBe('');
  });

  it('rejects an engine arm whose cite names no line', () => {
    expect(ENGINE_CITE_RE.test('the class reference says so')).toBe(false);
    expect(ENGINE_CITE_RE.test('audio_stream_player_3d.cpp:885')).toBe(true);
  });

  it('keeps an inert claim distinguishable from a bound', () => {
    // The two arms cite the same KIND of string and would be indistinguishable
    // once resolved, which is the collapse this split exists to prevent.
    const inert = entry({
      kind: 'engine-inert',
      at: 'sprite_2d.cpp:98',
      unused: 'region_rect is read only inside this branch',
    });
    expect(resolve(inert, census)).toContain('sprite_2d.cpp:98');
    expect(resolve(inert, census)).toContain('read only inside this branch');
    expect(resolve(entry({ kind: 'engine', at: 'sprite_2d.cpp:296' }), census)).toBe(
      'sprite_2d.cpp:296'
    );
  });

  it('reads the reason as the resolution for a no-engine-counterpart arm', () => {
    const e = entry({
      kind: 'no-engine-counterpart',
      scope: 'dangling-reference',
      because: 'the file declares no such id',
    });
    expect(resolve(e, census)).toBe('the file declares no such id');
  });
});
