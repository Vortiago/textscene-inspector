/**
 * VisibleOnScreenEnabler3D registration: it reuses the notifier's parse and component, so it reads
 * `aabb` and draws the same gizmo (ADR-0018).
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../r3f/nodeSupport';
import { VisibleOnScreenNotifier3D } from '../visibleonscreennotifier3d/Component';
import { parseVisibleOnScreenNotifier3D } from '../visibleonscreennotifier3d/parser';
import './index';
import './index.r3f';

describe('VisibleOnScreenEnabler3D registration', () => {
  it("registers the notifier's parser", () => {
    expect(nodeRegistry.getRegistration('VisibleOnScreenEnabler3D')?.parser).toBe(
      parseVisibleOnScreenNotifier3D
    );
  });

  it("registers the notifier's component", () => {
    expect(nodeComponentRegistry.get('VisibleOnScreenEnabler3D')).toBe(VisibleOnScreenNotifier3D);
  });

  it('declares no render intent', () => {
    expect(nodeComponentRegistry.renderIntentOf('VisibleOnScreenEnabler3D')).toBe('draws');
    expect(rendersOwnVisual('VisibleOnScreenEnabler3D')).toBe('draws');
  });
});
