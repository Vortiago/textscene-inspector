/**
 * VFlowContainer self-registration: importing `index.r3f` must wire the
 * native (WebGL canvas) painter, and the shared flow solver, which registers
 * itself for `VFlowContainer` too.
 */
import { describe, expect, it } from 'vitest';
import './index.r3f';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { VFlowContainer } from './Component';
import { flowContainerMinimumSize, flowContainerLayout } from '../flowcontainer/nativeSolver';

describe('VFlowContainer index.r3f self-registration', () => {
  it('registers the native painter', () => {
    expect(controlComponentRegistry.get('VFlowContainer')).toBe(VFlowContainer);
  });

  it('registers the shared minimum-size solver', () => {
    expect(controlSolverRegistry.minimumSize('VFlowContainer')).toBe(flowContainerMinimumSize);
  });

  it('registers the shared container-layout solver', () => {
    expect(controlSolverRegistry.containerLayout('VFlowContainer')).toBe(flowContainerLayout);
  });
});
