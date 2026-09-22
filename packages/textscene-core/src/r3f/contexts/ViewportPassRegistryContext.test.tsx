/**
 * `<ViewportPassProvider>` + `<ViewportPassOrchestrator>` — the single
 * `useFrame` that drives every registered offscreen viewport pass in
 * dependency order (`passOrder.ts`), replacing each publisher's own
 * `useFrame`. Exercised through `@react-three/test-renderer` since the
 * orchestrator must actually be inside a canvas frame loop to run.
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useEffect, type ReactNode } from 'react';

const warnCalls: unknown[][] = [];
vi.mock('../../logger.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../logger.js')>();
  return {
    ...actual,
    warn: (...args: unknown[]) => {
      warnCalls.push(args);
    },
  };
});

import {
  ViewportPassProvider,
  ViewportPassOrchestrator,
  useRegisterViewportPass,
  useViewportPassCycle,
  type ViewportPass,
} from './ViewportPassRegistryContext';

/** Registers `pass` at `path` for the lifetime of this component. */
function Registrar({ path, pass }: { path: string; pass: ViewportPass }) {
  const register = useRegisterViewportPass();
  useEffect(() => register(path, pass), [register, path, pass]);
  return null;
}

/** Reports the cycle (if any) at `path` into `seen` on every render. */
function CycleWatch({ path, seen }: { path: string; seen: (unknown | null)[] }) {
  seen.push(useViewportPassCycle(path));
  return null;
}

function mount(children: ReactNode) {
  return ReactThreeTestRenderer.create(
    <ViewportPassProvider>
      {children}
      <ViewportPassOrchestrator />
    </ViewportPassProvider>
  );
}

describe('useRegisterViewportPass (no provider)', () => {
  it('is a safe no-op, returning a cleanup function', async () => {
    let register: ReturnType<typeof useRegisterViewportPass> | null = null;
    function Read() {
      register = useRegisterViewportPass();
      return null;
    }
    await ReactThreeTestRenderer.create(<Read />);
    expect(typeof register).toBe('function');
    expect(typeof register!('x', { dependsOn: [], render: () => {} })).toBe('function');
  });
});

describe('<ViewportPassOrchestrator>', () => {
  it('drives a registered pass with no dependencies once per frame', async () => {
    let calls = 0;
    const renderer = await mount(
      <Registrar path="a" pass={{ dependsOn: [], render: () => calls++ }} />
    );
    await renderer.advanceFrames(1, 16);
    expect(calls).toBe(1);
    await renderer.advanceFrames(1, 16);
    expect(calls).toBe(2);
  });

  it('runs a dependency before its dependent every frame', async () => {
    const order: string[] = [];
    const renderer = await mount(
      <>
        <Registrar path="b" pass={{ dependsOn: ['a'], render: () => order.push('b') }} />
        <Registrar path="a" pass={{ dependsOn: [], render: () => order.push('a') }} />
      </>
    );
    await renderer.advanceFrames(1, 16);
    expect(order).toEqual(['a', 'b']);
  });

  it('a 3-deep nesting chain runs inner before outer', async () => {
    const order: string[] = [];
    const renderer = await mount(
      <>
        <Registrar
          path="Outer"
          pass={{ dependsOn: ['Outer/Middle'], render: () => order.push('Outer') }}
        />
        <Registrar
          path="Outer/Middle"
          pass={{ dependsOn: ['Outer/Middle/Inner'], render: () => order.push('Middle') }}
        />
        <Registrar
          path="Outer/Middle/Inner"
          pass={{ dependsOn: [], render: () => order.push('Inner') }}
        />
      </>
    );
    await renderer.advanceFrames(1, 16);
    expect(order).toEqual(['Inner', 'Middle', 'Outer']);
  });

  it('unregisters on unmount, so a later frame no longer drives it', async () => {
    let calls = 0;
    const renderer = await mount(
      <Registrar path="a" pass={{ dependsOn: [], render: () => calls++ }} />
    );
    await renderer.advanceFrames(1, 16);
    expect(calls).toBe(1);
    await renderer.update(
      <ViewportPassProvider>
        <ViewportPassOrchestrator />
      </ViewportPassProvider>
    );
    await renderer.advanceFrames(1, 16);
    expect(calls).toBe(1);
  });

  describe('a cycle', () => {
    /**
     * Only the pass `orderViewportPasses` reports as the offending SAMPLER is
     * skipped — the one whose dependency could not be satisfied. Its
     * counterpart still renders: once the sampler stops changing, whatever it
     * depends on has a stable (frozen, not oscillating) input to sample, which
     * is exactly what keeps output deterministic frame over frame.
     */
    it('never drives the offending sampler, but still drives its counterpart and an unrelated pass', async () => {
      let aCalls = 0;
      let bCalls = 0;
      let otherCalls = 0;
      const renderer = await mount(
        <>
          <Registrar path="a" pass={{ dependsOn: ['b'], render: () => aCalls++ }} />
          <Registrar path="b" pass={{ dependsOn: ['a'], render: () => bCalls++ }} />
          <Registrar path="other" pass={{ dependsOn: [], render: () => otherCalls++ }} />
        </>
      );
      await renderer.advanceFrames(1, 16);
      // `orderViewportPasses` (visiting registration order a, then b) reports
      // 'b' as the sampler whose dependency on 'a' closes the cycle.
      expect(aCalls).toBe(1);
      expect(bCalls).toBe(0);
      expect(otherCalls).toBe(1);
    });

    it('exposes the cycle to useViewportPassCycle for the offending sampler only', async () => {
      const seenA: (unknown | null)[] = [];
      const seenOther: (unknown | null)[] = [];
      await mount(
        <>
          <Registrar path="a" pass={{ dependsOn: ['b'], render: () => {} }} />
          <Registrar path="b" pass={{ dependsOn: ['a'], render: () => {} }} />
          <Registrar path="other" pass={{ dependsOn: [], render: () => {} }} />
          <CycleWatch path="b" seen={seenA} />
          <CycleWatch path="other" seen={seenOther} />
        </>
      );
      expect(seenA.at(-1)).toMatchObject({ sampler: 'b' });
      expect(seenOther.at(-1)).toBeNull();
    });

    it('logs a warning naming the offending sampler', async () => {
      warnCalls.length = 0;
      await mount(
        <>
          <Registrar path="a" pass={{ dependsOn: ['b'], render: () => {} }} />
          <Registrar path="b" pass={{ dependsOn: ['a'], render: () => {} }} />
        </>
      );
      const matched = warnCalls.filter((args) => String(args[0]).includes('b'));
      expect(matched.length).toBeGreaterThan(0);
    });
  });
});
