/**
 * VisualInstance3D registration: it is parsed, and it draws nothing on purpose (ADR-0008), not for want
 * of an implementation.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { parseVisualInstance3D } from './parser';
import { Node3D } from '../../base/node3d/Component';
import './index';
import './index.r3f';

describe('VisualInstance3D registration', () => {
  it('registers its own parser, which reads layers on top of the Node3D fields', () => {
    const registration = nodeRegistry.getRegistration('VisualInstance3D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseVisualInstance3D);
  });

  it('reuses the Node3D component so children keep their transform space', () => {
    expect(nodeComponentRegistry.get('VisualInstance3D')).toBe(Node3D);
  });

  it('declares drawing nothing, so the sheet may claim linter-only', () => {
    expect(nodeComponentRegistry.renderIntentOf('VisualInstance3D')).toBe('transform-only');
  });
});
