/**
 * Tests that the LinkButton parser registers in the NodeRegistry and the native painter in the
 * ControlComponentRegistry, since Controls render on the native 2D-UI canvas (ADR-0002), not in the
 * 3D NodeComponentRegistry.
 */
import { describe, it, expect } from 'vitest';
import './index'; // parser registration side effect
import './index.r3f'; // native component registration side effect
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { parseLinkButton } from './parser';
import { LinkButton } from './Component';
import { linkButtonMinimumSize } from './nativeSolver';

describe('LinkButton registration', () => {
  it('registers the parser under its type name', () => {
    const reg = nodeRegistry.getRegistration('LinkButton');
    expect(reg).not.toBeNull();
    expect(reg!.parser).toBe(parseLinkButton);
  });

  it('registers the native (WebGL) painter and rect solver', () => {
    expect(controlComponentRegistry.get('LinkButton')).toBe(LinkButton);
    expect(controlSolverRegistry.minimumSize('LinkButton')).toBe(linkButtonMinimumSize);
  });
});
