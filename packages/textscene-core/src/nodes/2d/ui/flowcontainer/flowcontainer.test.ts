/** FlowContainer registration: the parser. `index.r3f.test.ts` covers the render registration. */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { parseFlowContainer } from './parser';
import './index';

describe('FlowContainer registration', () => {
  it('registers its own parser', () => {
    const registration = nodeRegistry.getRegistration('FlowContainer');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseFlowContainer);
  });
});
