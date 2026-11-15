/**
 * `renderingPassIds` and `TargetRenderState`: the update mode and the clear mode of a SubViewport,
 * asserted on plain records. Each expected value is a Godot 4.6.3 measurement.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SubViewportClearMode, SubViewportUpdateMode } from '../../godot/scene/viewport';
import { GateClock, renderingPassIds, TargetRenderState, type GatedPass } from './renderGate';

const { DISABLED, ONCE, WHEN_VISIBLE, WHEN_PARENT_VISIBLE, ALWAYS } = SubViewportUpdateMode;

function pass(
  id: string,
  updateMode: number,
  { enclosingId = null, hasRendered = false }: { enclosingId?: string | null; hasRendered?: boolean } = {}
): GatedPass {
  return { id, updateMode, enclosingId, state: { hasRendered } };
}

function rendering(passes: GatedPass[], index: number, sampled: string[] = []): string[] {
  return [...renderingPassIds(passes, { index, sampledIds: new Set(sampled) })];
}

describe('renderingPassIds', () => {
  it('never renders a DISABLED pass', () => {
    expect(rendering([pass('a', DISABLED)], 5)).toEqual([]);
  });

  it('renders a ONCE pass on frame 1 and not before', () => {
    expect(rendering([pass('a', ONCE)], 0)).toEqual([]);
    expect(rendering([pass('a', ONCE)], 1)).toEqual(['a']);
  });

  it('stops rendering a ONCE pass after its first render', () => {
    expect(rendering([pass('a', ONCE, { hasRendered: true })], 2)).toEqual([]);
  });

  it('renders a WHEN_VISIBLE pass only once its target was sampled', () => {
    expect(rendering([pass('a', WHEN_VISIBLE)], 1)).toEqual([]);
    expect(rendering([pass('a', WHEN_VISIBLE)], 2, ['a'])).toEqual(['a']);
  });

  it('renders an ALWAYS pass on every frame, before the load too', () => {
    expect(rendering([pass('a', ALWAYS)], 0)).toEqual(['a']);
  });

  it('renders a WHEN_PARENT_VISIBLE pass at the root', () => {
    expect(rendering([pass('a', WHEN_PARENT_VISIBLE)], 0)).toEqual(['a']);
  });

  it('renders a WHEN_PARENT_VISIBLE pass when its enclosing pass renders', () => {
    const passes = [pass('outer', ALWAYS), pass('inner', WHEN_PARENT_VISIBLE, { enclosingId: 'outer' })];
    expect(rendering(passes, 1)).toEqual(['outer', 'inner']);
  });

  it('skips a WHEN_PARENT_VISIBLE pass under a DISABLED pass', () => {
    const passes = [pass('outer', DISABLED), pass('inner', WHEN_PARENT_VISIBLE, { enclosingId: 'outer' })];
    expect(rendering(passes, 1)).toEqual([]);
  });

  it('follows a chain of WHEN_PARENT_VISIBLE passes to the pass that decides', () => {
    const passes = [
      pass('leaf', WHEN_PARENT_VISIBLE, { enclosingId: 'mid' }),
      pass('mid', WHEN_PARENT_VISIBLE, { enclosingId: 'top' }),
      pass('top', ONCE, { hasRendered: true }),
    ];
    expect(rendering(passes, 3)).toEqual([]);
  });

  it('renders a WHEN_PARENT_VISIBLE pass under a ONCE pass in the frame the ONCE pass renders', () => {
    const passes = [pass('outer', ONCE), pass('inner', WHEN_PARENT_VISIBLE, { enclosingId: 'outer' })];
    expect(rendering(passes, 1)).toEqual(['outer', 'inner']);
  });

  it('keeps a pass whose enclosing viewport has no pass rendering', () => {
    expect(rendering([pass('a', WHEN_PARENT_VISIBLE, { enclosingId: 'bare' })], 1)).toEqual(['a']);
  });
});

describe('TargetRenderState', () => {
  const projectColor = new THREE.Color(0.3, 0.3, 0.3);
  const rgb = (color: THREE.Color) => [color.r, color.g, color.b];

  it('clears every render under ALWAYS', () => {
    const state = new TargetRenderState();
    expect(state.takeRender(SubViewportClearMode.ALWAYS, projectColor).clears).toBe(true);
    expect(state.takeRender(SubViewportClearMode.ALWAYS, projectColor).clears).toBe(true);
  });

  it('never clears under NEVER and paints opaque black', () => {
    const state = new TargetRenderState();
    const render = state.takeRender(SubViewportClearMode.NEVER, projectColor);
    expect(render.clears).toBe(false);
    expect(rgb(render.color)).toEqual([0, 0, 0]);
  });

  it('clears the first render under ONCE and no later one', () => {
    const state = new TargetRenderState();
    expect(state.takeRender(SubViewportClearMode.ONCE, projectColor).clears).toBe(true);
    expect(state.takeRender(SubViewportClearMode.ONCE, projectColor).clears).toBe(false);
  });

  it('keeps the colour of the one ONCE clear after the project colour changes', () => {
    const state = new TargetRenderState();
    state.takeRender(SubViewportClearMode.ONCE, projectColor);
    const later = state.takeRender(SubViewportClearMode.ONCE, new THREE.Color(1, 0, 0));
    expect(later.color.r).toBeCloseTo(0.3);
  });

  it('counts a render only when one is taken', () => {
    const state = new TargetRenderState();
    expect(state.hasRendered).toBe(false);
    state.takeRender(SubViewportClearMode.ALWAYS, projectColor);
    expect(state.hasRendered).toBe(true);
  });

  it('clears a ONCE clear again after the clear mode is set again', () => {
    const state = new TargetRenderState();
    state.takeRender(SubViewportClearMode.ONCE, projectColor);
    expect(state.takeRender(SubViewportClearMode.ONCE, projectColor).clears).toBe(false);
    state.takeRender(SubViewportClearMode.ALWAYS, projectColor);
    expect(state.takeRender(SubViewportClearMode.ONCE, projectColor).clears).toBe(true);
  });

  it('keeps a spent ONCE update after the clear mode changes', () => {
    const state = new TargetRenderState();
    state.takeRender(SubViewportClearMode.ONCE, projectColor);
    state.takeRender(SubViewportClearMode.ALWAYS, projectColor);
    expect(state.hasRendered).toBe(true);
  });

  it('renders a spent ONCE update again after rearm', () => {
    const state = new TargetRenderState();
    state.takeRender(SubViewportClearMode.ALWAYS, projectColor);
    state.rearm();
    expect(state.hasRendered).toBe(false);
  });

  it('starts with its ONCE update and its ONCE clear pending', () => {
    const state = new TargetRenderState();
    expect(state.hasRendered).toBe(false);
    expect(state.takeRender(SubViewportClearMode.ONCE, projectColor).clears).toBe(true);
  });
});

describe('GateClock', () => {
  it('counts no frame before the scene is loaded', () => {
    const clock = new GateClock();
    expect(clock.begin(false).index).toBe(0);
    expect(clock.begin(true).index).toBe(1);
    expect(clock.begin(true).index).toBe(2);
  });

  it('marks a sampled target for the next frame, and spends the mark on a render', () => {
    const clock = new GateClock();
    clock.begin(true);
    clock.mark('a');
    expect(clock.begin(true).sampledIds.has('a')).toBe(true);
    clock.spend('a');
    expect(clock.begin(true).sampledIds.has('a')).toBe(false);
  });

  it('marks nothing in a frame before frame 1', () => {
    const clock = new GateClock();
    clock.begin(false);
    clock.mark('a');
    expect(clock.begin(true).sampledIds.has('a')).toBe(false);
  });

  it('counts the first frame of a clock that starts unloaded as unloaded', () => {
    const clock = new GateClock(true);
    expect(clock.begin(true).index).toBe(0);
    expect(clock.begin(true).index).toBe(1);
  });

  it('forgets the marks of passes that are gone on prune', () => {
    const clock = new GateClock();
    clock.begin(true);
    clock.mark('a');
    clock.mark('b');
    clock.prune((id) => id === 'b');
    expect([...clock.begin(true).sampledIds]).toEqual(['b']);
  });
});
