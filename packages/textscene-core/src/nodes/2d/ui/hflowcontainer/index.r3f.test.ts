/**
 * HFlowContainer self-registration: importing `index.r3f` must wire the
 * native (WebGL canvas) painter, and the shared flow solver, which registers
 * itself for `HFlowContainer` too.
 */
import { describe, expect, it } from 'vitest';
import './index.r3f';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { HFlowContainer } from './Component';

describe('HFlowContainer index.r3f self-registration', () => {
  it('registers the native painter', () => {
    expect(controlComponentRegistry.get('HFlowContainer')).toBe(HFlowContainer);
  });

  it('registers the shared minimum-size solver', () => {
    const shared = controlSolverRegistry.minimumSize('FlowContainer');
    expect(shared).toBeTypeOf('function');
    expect(controlSolverRegistry.minimumSize('HFlowContainer')).toBe(shared);
  });

  it('registers the shared container-layout solver', () => {
    const shared = controlSolverRegistry.containerLayout('FlowContainer');
    expect(shared).toBeTypeOf('function');
    expect(controlSolverRegistry.containerLayout('HFlowContainer')).toBe(shared);
  });
});
