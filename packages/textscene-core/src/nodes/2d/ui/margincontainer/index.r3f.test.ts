/**
 * MarginContainer self-registration: importing `index.r3f` must wire the DOM
 * component, the native (WebGL canvas) painter and both native rect-solver
 * functions into their respective registries — the whole point of the
 * self-registration convention (ADR-0001) is that nothing else has to.
 */
import { describe, expect, it } from 'vitest';
import './index.r3f';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { MarginContainer } from './Component';
import { MarginContainerNative } from './NativeComponent';
import { marginContainerMinimumSize, marginContainerLayout } from './nativeSolver';

describe('MarginContainer index.r3f self-registration', () => {
  it('registers the DOM component', () => {
    expect(controlComponentRegistry.get('MarginContainer')).toBe(MarginContainer);
  });

  it('registers the native painter', () => {
    expect(controlComponentRegistry.getNative('MarginContainer')).toBe(MarginContainerNative);
  });

  it('registers the minimum-size solver', () => {
    expect(controlSolverRegistry.minimumSize('MarginContainer')).toBe(marginContainerMinimumSize);
  });

  it('registers the container-layout solver', () => {
    expect(controlSolverRegistry.containerLayout('MarginContainer')).toBe(marginContainerLayout);
  });
});
