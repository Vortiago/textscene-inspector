/**
 * ADR-0002's three registries (`nodeRegistry`, `nodeComponentRegistry`,
 * `controlComponentRegistry`) overwrite a duplicate `typeName` and warn. This fails on any
 * such warning from the production barrels, so two slices cannot claim one typeName.
 */
import { describe, expect, it, vi } from 'vitest';

const warnCalls: unknown[][] = [];

// Hoisted before the barrels, and keyed by resolved path, so it intercepts every module's
// import of `logger.js` whatever its relative specifier.
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

// The barrels the real apps import: parser/TscnParser.ts fills nodeRegistry and
// r3f/nodes/index.ts fills nodeComponentRegistry. `r3f/controls/index.ts` needs its own
// import, as the app loads it through `lazy()` and `r3f/nodes/index.ts` does not reach it.
import '../parser/TscnParser.js';
import '../r3f/nodes/index.js';
import '../r3f/controls/index.js';
import { nodeComponentRegistry } from '../r3f/NodeComponentRegistry.js';
import { controlComponentRegistry } from '../r3f/controls/ControlComponentRegistry.js';

function duplicateRegistrationWarnings(): string[] {
  return warnCalls
    .map((args) => String(args[0]))
    .filter((msg) => /already registered/i.test(msg));
}

describe('registration-collision guard (#217)', () => {
  it('production self-registration reports zero duplicate-typeName collisions', () => {
    expect(duplicateRegistrationWarnings()).toEqual([]);
  });

  it('has all three registries populated, so none can pass by being empty', () => {
    // An empty registry would pass the zero-collision test above.
    expect(nodeComponentRegistry.getAllTypeNames().length).toBeGreaterThan(150);
    expect(controlComponentRegistry.getAllTypeNames().length).toBeGreaterThan(15);
  });

  it('sanity: a DELIBERATE duplicate registration is captured by the spy', () => {
    // A positive control: the spy records a real collision, so the empty result above is no
    // spy that never intercepted. It runs after that test, so the probes cannot reach it.
    const before = duplicateRegistrationWarnings().length;
    const Probe = () => null;
    nodeComponentRegistry.register({ typeName: '__CollisionProbe__', Component: Probe });
    nodeComponentRegistry.register({ typeName: '__CollisionProbe__', Component: Probe });
    expect(duplicateRegistrationWarnings().length).toBe(before + 1);
  });
});
