/**
 * SplitContainer registration — parsed, validated, and rendered through the
 * native (WebGL canvas) painter registered in `index.r3f.ts`.
 *
 * `nodeComponentRegistry` is the DOM/3D dispatcher's own table; 2D-UI
 * Controls never register there, so a bare Container-family type reads as
 * not-implemented on that path whether or not the native canvas draws it.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { parseSplitContainer } from './parser';
import './index';

describe('SplitContainer registration', () => {
  it('registers its own parser (Control + split_offset/collapsed/dragger_visibility + vertical)', () => {
    const registration = nodeRegistry.getRegistration('SplitContainer');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseSplitContainer);
  });

  it('registers no DOM/3D render component (2D-UI Controls never do)', () => {
    expect(nodeComponentRegistry.get('SplitContainer')).toBeUndefined();
  });
});
