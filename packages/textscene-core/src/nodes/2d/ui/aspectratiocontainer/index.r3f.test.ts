/**
 * AspectRatioContainer self-registration: importing `index.r3f` must wire the
 * native (WebGL canvas) painter and both native rect-solver functions into
 * their respective registries — the whole point of the self-registration
 * convention (ADR-0001) is that nothing else has to.
 */
import { describe, expect, it } from 'vitest';
import './index.r3f';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { AspectRatioContainer } from './Component';
import { aspectRatioContainerMinimumSize, aspectRatioContainerLayout } from './nativeSolver';

describe('AspectRatioContainer index.r3f self-registration', () => {
  it('registers the native painter', () => {
    expect(controlComponentRegistry.get('AspectRatioContainer')).toBe(AspectRatioContainer);
  });

  it('registers the minimum-size solver', () => {
    expect(controlSolverRegistry.minimumSize('AspectRatioContainer')).toBe(aspectRatioContainerMinimumSize);
  });

  it('registers the container-layout solver', () => {
    expect(controlSolverRegistry.containerLayout('AspectRatioContainer')).toBe(aspectRatioContainerLayout);
  });
});
