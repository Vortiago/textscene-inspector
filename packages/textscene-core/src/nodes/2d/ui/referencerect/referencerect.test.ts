/**
 * Tests the ReferenceRect parser registration. A 2D-UI Control never registers
 * in the 3D `nodeComponentRegistry`: `index.r3f.test.ts` tests its
 * `ControlComponentRegistry` painter.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { parseReferenceRect } from './parser';
import './index';

describe('ReferenceRect registration', () => {
  it('registers its own parser', () => {
    const registration = nodeRegistry.getRegistration('ReferenceRect');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseReferenceRect);
  });

  it('registers nothing in the 3D-node registry — a Control renders through ControlComponentRegistry instead', () => {
    expect(nodeComponentRegistry.get('ReferenceRect')).toBeUndefined();
  });
});
