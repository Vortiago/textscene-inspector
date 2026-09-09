/**
 * The test-kit's own diagnostic lookup.
 *
 * `expectDiagnostic`'s `where` is matched by message SUBSTRING, so `{ prop:
 * 'resource reference' }` names the sentence `createResourceReferenceValidator`
 * emits for every resource slot and `{ prop: 'theme_override_constants' }`
 * names a whole property family. Picking the first hit made those assertions
 * about whichever diagnostic the linter sorted first — a fixture gaining a
 * second bad slot silently re-pointed the test without changing it.
 *
 * The kit refuses that now: a `where` several diagnostics answer is red until it
 * is narrowed. `expectNoDiagnostic` keeps the family semantics, because "none of
 * them" is the stronger claim there.
 *
 * These cases exist because the refusal is invisible from inside the slice
 * tests it protects — every one of them passes whether or not the ambiguity
 * check fires. An `it` that should have failed cannot be caught from outside,
 * so each is driven through `toThrow` here.
 */

import { describe, it, expect } from 'vitest';
import { expectDiagnostic, expectNoDiagnostic, lint, node, scene } from './testing/testkit';
import './index.js'; // trigger all validator + rule registrations

/**
 * Two bad resource slots on one node. Both diagnostics carry the shared
 * "must be a resource reference" sentence, so `{ prop: 'resource reference' }`
 * cannot tell them apart — the exact shape six live call sites used.
 */
const TWO_RESOURCE_SLOTS = scene(
  node('GPUParticles3D', {
    process_material: '"not-a-reference"',
    draw_pass_1: '"not-a-reference"',
  })
);

/** One bad slot: the same `where` is unambiguous here. */
const ONE_RESOURCE_SLOT = scene(
  node('GPUParticles3D', { process_material: '"not-a-reference"' })
);

describe('test-kit diagnostic lookup', () => {
  it('the two scenes carry the diagnostic counts every case below claims', () => {
    // Without this the `toThrow` cases pass whenever the scene stops producing
    // diagnostics at all, which is a different failure wearing the same colour.
    const shared = 'resource reference';
    expect(lint(TWO_RESOURCE_SLOTS).filter(d => d.message.includes(shared))).toHaveLength(2);
    expect(lint(ONE_RESOURCE_SLOT).filter(d => d.message.includes(shared))).toHaveLength(1);
  });

  it('refuses a `where` that two diagnostics answer', () => {
    expect(() => expectDiagnostic(TWO_RESOURCE_SLOTS, { prop: 'resource reference' })).toThrow(
      /must identify ONE claim/
    );
  });

  it('names the candidates it could not choose between', () => {
    // The failure has to be actionable: which two, and what would separate them.
    expect(() => expectDiagnostic(TWO_RESOURCE_SLOTS, { prop: 'resource reference' })).toThrow(
      /process_material[\s\S]*draw_pass_1|draw_pass_1[\s\S]*process_material/
    );
  });

  it('accepts the same `where` once it identifies one diagnostic', () => {
    expect(
      expectDiagnostic(TWO_RESOURCE_SLOTS, {
        prop: 'resource reference',
        contains: ['process_material'],
      }).message
    ).toContain('process_material');
  });

  it('leaves an unambiguous `where` alone', () => {
    expect(expectDiagnostic(ONE_RESOURCE_SLOT, { prop: 'resource reference' }).severity).toBe(
      'error'
    );
  });

  it('still fails when nothing matches, and says so differently', () => {
    expect(() => expectDiagnostic(ONE_RESOURCE_SLOT, { prop: 'no diagnostic says this' })).toThrow(
      /no diagnostic matches/
    );
  });

  it('keeps `expectNoDiagnostic` a claim about the whole family', () => {
    // Narrowing the negative by severity/contains would weaken it from "no
    // diagnostic mentions this" to "none at that tier".
    expect(() => expectNoDiagnostic(TWO_RESOURCE_SLOTS, { prop: 'resource reference' })).toThrow();
    expectNoDiagnostic(ONE_RESOURCE_SLOT, { prop: 'no diagnostic says this' });
  });
});
