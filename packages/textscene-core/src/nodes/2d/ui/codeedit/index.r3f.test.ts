/**
 * CodeEdit self-registration: importing `index.r3f` must wire the native
 * painter and the size-dependent rect solver into their respective registries.
 */
import { describe, expect, it } from 'vitest';
import './index.r3f';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { CodeEdit } from './Component';
import { codeEditMinimumSize } from './nativeSolver';

describe('CodeEdit index.r3f self-registration', () => {
  it('registers the native painter', () => {
    expect(controlComponentRegistry.get('CodeEdit')).toBe(CodeEdit);
  });

  it('registers the minimum-size solver', () => {
    expect(controlSolverRegistry.minimumSize('CodeEdit')).toBe(codeEditMinimumSize);
  });

  it('declares CodeEdit size-dependent, matching TextEdit', () => {
    expect(controlSolverRegistry.isSizeDependentMinimum('CodeEdit')).toBe(true);
  });

  it('registers no container layout — a CodeEdit has no Control children to place', () => {
    expect(controlSolverRegistry.containerLayout('CodeEdit')).toBeUndefined();
  });
});
