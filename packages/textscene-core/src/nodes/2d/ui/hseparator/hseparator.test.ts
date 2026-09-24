/**
 * HSeparator registration, parser half. A 2D-UI Control never registers in the
 * 3D `nodeComponentRegistry`; `index.r3f.test.ts` covers its painter in
 * `ControlComponentRegistry`.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { parseControl } from '../control/parser';
import './index';

describe('HSeparator registration', () => {
  it('registers the parseControl parse it reuses', () => {
    const registration = nodeRegistry.getRegistration('HSeparator');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseControl);
  });

  it('registers nothing in the 3D-node registry — a Control renders through ControlComponentRegistry instead', () => {
    expect(nodeComponentRegistry.get('HSeparator')).toBeUndefined();
  });
});
