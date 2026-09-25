/**
 * CenterContainer self-registration (ADR-0001): importing `index.r3f` wires the
 * native (WebGL canvas) painter and both native rect-solver functions into
 * their registries.
 */
import { describe, expect, it } from 'vitest';
import './index.r3f';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { CenterContainer } from './Component';
import { centerContainerMinimumSize, centerContainerLayout } from './nativeSolver';

describe('CenterContainer index.r3f self-registration', () => {
  it('registers the native painter', () => {
    expect(controlComponentRegistry.get('CenterContainer')).toBe(CenterContainer);
  });

  it('registers the minimum-size solver', () => {
    expect(controlSolverRegistry.minimumSize('CenterContainer')).toBe(centerContainerMinimumSize);
  });

  it('registers the container-layout solver', () => {
    expect(controlSolverRegistry.containerLayout('CenterContainer')).toBe(centerContainerLayout);
  });
});
