/**
 * VSeparator registration — the parser half only.
 *
 * `nodeComponentRegistry` is the 3D-node registry (`r3f/nodes/`); a 2D-UI
 * Control never registers there, drawn or not — see `index.r3f.test.ts` for
 * the native (WebGL canvas) painter this type DOES register, into
 * `ControlComponentRegistry` instead.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { parseControl } from '../control/parser';
import './index';

describe('VSeparator registration', () => {
  it('registers the parseControl parse it reuses', () => {
    const registration = nodeRegistry.getRegistration('VSeparator');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseControl);
  });

  it('registers nothing in the 3D-node registry — a Control renders through ControlComponentRegistry instead', () => {
    expect(nodeComponentRegistry.get('VSeparator')).toBeUndefined();
  });
});
