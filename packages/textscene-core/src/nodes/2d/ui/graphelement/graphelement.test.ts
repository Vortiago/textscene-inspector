/** GraphElement registration: parser wiring. */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { parseGraphElement } from './parser';
import './index';

describe('GraphElement registration', () => {
  it('registers its own parser', () => {
    const registration = nodeRegistry.getRegistration('GraphElement');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseGraphElement);
  });
});
