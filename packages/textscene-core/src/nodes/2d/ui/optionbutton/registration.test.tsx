/**
 * Tests that the OptionButton parser registers in the NodeRegistry and the native painter in the
 * ControlComponentRegistry (ADR-0002).
 */
import { describe, it, expect } from 'vitest';
import './index'; // parser registration side effect
import './index.r3f'; // native component registration side effect
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { parseOptionButton } from './parser';
import { OptionButton } from './Component';
import { optionButtonMinimumSize } from './nativeSolver';

describe('OptionButton registration', () => {
  it('registers the parser under its type name', () => {
    const reg = nodeRegistry.getRegistration('OptionButton');
    expect(reg).not.toBeNull();
    expect(reg!.parser).toBe(parseOptionButton);
  });

  it('registers the native (WebGL) painter and rect solver', () => {
    expect(controlComponentRegistry.get('OptionButton')).toBe(OptionButton);
    expect(controlSolverRegistry.minimumSize('OptionButton')).toBe(optionButtonMinimumSize);
  });
});
