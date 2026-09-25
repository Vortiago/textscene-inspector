/**
 * BoxContainer registration: parsed, validated, and drawn by the native (WebGL canvas)
 * painter in `index.r3f.ts`. 2D-UI Controls never register in `nodeComponentRegistry`,
 * so that path reads a Container-family type as not implemented.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { parseBoxContainer } from './parser';
import './index';

describe('BoxContainer registration', () => {
  it('registers its own parser (Control + alignment + vertical)', () => {
    const registration = nodeRegistry.getRegistration('BoxContainer');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseBoxContainer);
  });

  it('registers no DOM/3D render component (2D-UI Controls never do)', () => {
    expect(nodeComponentRegistry.get('BoxContainer')).toBeUndefined();
  });
});
