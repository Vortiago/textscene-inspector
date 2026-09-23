/**
 * Tests that importing `index.r3f` registers the native painter and both rect-solver functions, since
 * under self-registration (ADR-0001) nothing else does.
 */
import { describe, expect, it } from 'vitest';
import './index.r3f';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { MarginContainer } from './Component';
import { marginContainerMinimumSize, marginContainerLayout } from './nativeSolver';

describe('MarginContainer index.r3f self-registration', () => {
  it('registers the native painter', () => {
    expect(controlComponentRegistry.get('MarginContainer')).toBe(MarginContainer);
  });

  it('registers the minimum-size solver', () => {
    expect(controlSolverRegistry.minimumSize('MarginContainer')).toBe(marginContainerMinimumSize);
  });

  it('registers the container-layout solver', () => {
    expect(controlSolverRegistry.containerLayout('MarginContainer')).toBe(marginContainerLayout);
  });
});
