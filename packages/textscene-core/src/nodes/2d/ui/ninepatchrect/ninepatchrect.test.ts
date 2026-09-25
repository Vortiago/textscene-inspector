/** Tests the NinePatchRect registration: parser and native painter. */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { parseNinePatchRect } from './parser';
import './index';
import './index.r3f';

describe('NinePatchRect registration', () => {
  it('registers its own parser', () => {
    const registration = nodeRegistry.getRegistration('NinePatchRect');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNinePatchRect);
  });

  it('registers no top-level node component: NinePatchRect draws only through the Control walker', () => {
    expect(nodeComponentRegistry.get('NinePatchRect')).toBeUndefined();
  });

  it('registers a native (WebGL canvas) painter and a minimum-size solver', () => {
    expect(controlComponentRegistry.has('NinePatchRect')).toBe(true);
    expect(controlSolverRegistry.minimumSize('NinePatchRect')).toBeDefined();
  });
});
