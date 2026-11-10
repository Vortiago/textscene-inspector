/**
 * AcceptDialog registration: parsed and validated as a Window, and drawn as an embedded window.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../r3f/nodeSupport';
import { parseDialog } from '../acceptdialog/parser';
import './index';
import './index.r3f';

describe('AcceptDialog registration', () => {
  it('registers the dialog parse, which reads the Window class defaults and the dialog text', () => {
    const registration = nodeRegistry.getRegistration('AcceptDialog');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseDialog);
  });

  it('draws as a viewport its embedder shows', () => {
    expect(nodeComponentRegistry.renderIntentOf('AcceptDialog')).toBe('draws');
    expect(rendersOwnVisual('AcceptDialog')).toBe('draws');
  });
});
