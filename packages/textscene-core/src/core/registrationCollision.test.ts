/**
 * Registration-collision guard.
 *
 * ADR-0002's three type registries — `nodeRegistry` (parser domain),
 * `nodeComponentRegistry` (3D render domain), `controlComponentRegistry` (2D
 * render domain) — all silently OVERWRITE a duplicate `typeName` registration
 * (HMR-friendly), each backed by the shared `createTypeRegistry`, whose
 * `logger.warn` reports every duplicate. A genuine collision between two
 * DIFFERENT slices registering the
 * SAME typeName would previously ship silently; this test fails the moment
 * production's real self-registration barrels produce even one such warning,
 * so a future copy-paste-a-slice mistake (or a merge that leaves two slices
 * both claiming a typeName) turns red instead of overwriting silently.
 *
 * Mocks `logger.warn` (hoisted, so it intercepts every module's own import
 * of the SAME resolved `logger.js` file regardless of each file's own
 * relative specifier) BEFORE importing the production barrels, then asserts
 * none of the captured warnings mention a duplicate registration.
 */
import { describe, expect, it, vi } from 'vitest';

const warnCalls: unknown[][] = [];

vi.mock('../logger.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../logger.js')>();
  return {
    ...actual,
    warn: (...args: unknown[]) => {
      warnCalls.push(args);
      return actual.warn(...(args as Parameters<typeof actual.warn>));
    },
  };
});

// Side-effect imports: the SAME barrels the real apps import — parser/TscnParser.ts
// registers every slice's parser+formatter into nodeRegistry; r3f/nodes/index.ts
// registers every slice's render component into nodeComponentRegistry (3D) and
// controlComponentRegistry (2D, via the Control slices' own index.r3f.ts).
import '../parser/TscnParser.js';
import '../r3f/nodes/index.js';
import { nodeComponentRegistry } from '../r3f/NodeComponentRegistry.js';

function duplicateRegistrationWarnings(): string[] {
  return warnCalls
    .map((args) => String(args[0]))
    .filter((msg) => /already registered/i.test(msg));
}

describe('registration-collision guard (#217)', () => {
  it('production self-registration reports zero duplicate-typeName collisions', () => {
    expect(duplicateRegistrationWarnings()).toEqual([]);
  });

  it('sanity: a DELIBERATE duplicate registration is captured by the spy', () => {
    // Positive control for the mock wiring: prove that when a collision DOES
    // happen through a production registry, the spy records it — so the empty
    // result above can't be hiding a spy that silently never intercepted.
    // (Runs after the zero-collision assertion, so the probe entries below
    // can't contaminate it.)
    const before = duplicateRegistrationWarnings().length;
    const Probe = () => null;
    nodeComponentRegistry.register({ typeName: '__CollisionProbe__', Component: Probe });
    nodeComponentRegistry.register({ typeName: '__CollisionProbe__', Component: Probe });
    expect(duplicateRegistrationWarnings().length).toBe(before + 1);
  });
});
