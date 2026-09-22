/**
 * BoxContainer registration — parsed, validated, and rendered through the
 * native (WebGL canvas) painter registered in `index.r3f.ts`.
 *
 * `nodeComponentRegistry` is the DOM/3D dispatcher's own table; 2D-UI
 * Controls never register there, so a bare Container-family type reads as
 * not-implemented on that path whether or not the native canvas draws it.
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
