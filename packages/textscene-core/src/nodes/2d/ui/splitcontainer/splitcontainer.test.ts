/**
 * SplitContainer registration: parsed, validated and drawn by the native painter in `index.r3f.ts`.
 * 2D-UI Controls never register in `nodeComponentRegistry`, the 3D dispatcher's table, so this
 * type reads as not implemented there whether or not the native canvas draws it.
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
