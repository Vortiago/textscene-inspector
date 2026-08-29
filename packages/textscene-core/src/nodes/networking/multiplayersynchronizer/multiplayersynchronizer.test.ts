/**
 * MultiplayerSynchronizer registration — it is parsed, and it draws nothing on purpose
 * (ADR-0008) rather than for want of an implementation.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { parseNode } from '../../node/parser';
import { Node } from '../../node/Component';
import './index';
import './index.r3f';

describe('MultiplayerSynchronizer registration', () => {
  it('registers the parseNode parse it reuses', () => {
    const registration = nodeRegistry.getRegistration('MultiplayerSynchronizer');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNode);
  });

  it('reuses the Node component so children keep their transform space', () => {
    expect(nodeComponentRegistry.get('MultiplayerSynchronizer')).toBe(Node);
  });

  it('declares drawing nothing, so the sheet may claim linter-only', () => {
    expect(nodeComponentRegistry.isTransformOnly('MultiplayerSynchronizer')).toBe(true);
  });
});
