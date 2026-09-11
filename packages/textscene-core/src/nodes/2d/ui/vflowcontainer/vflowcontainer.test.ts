/** VFlowContainer registration — parser. Render registration: `index.r3f.test.ts`. */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { parseFlowContainer } from '../flowcontainer/parser';
import './index';

describe('VFlowContainer registration', () => {
  it('reuses the FlowContainer parser', () => {
    const registration = nodeRegistry.getRegistration('VFlowContainer');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseFlowContainer);
  });
});
