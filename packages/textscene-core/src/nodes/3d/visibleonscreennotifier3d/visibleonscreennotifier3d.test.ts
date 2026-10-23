/**
 * VisibleOnScreenNotifier3D registration: it draws nothing at runtime, so it declares no render
 * intent, and its component draws the editor gizmo of its box for every node (ADR-0056).
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../r3f/nodeSupport';
import { VisibleOnScreenNotifier3D } from './Component';
import { parseVisibleOnScreenNotifier3D } from './parser';
import './index';
import './index.r3f';

describe('VisibleOnScreenNotifier3D registration', () => {
  it('registers the parser that reads aabb', () => {
    expect(nodeRegistry.getRegistration('VisibleOnScreenNotifier3D')?.parser).toBe(
      parseVisibleOnScreenNotifier3D
    );
  });

  it('registers the component that draws the gizmo', () => {
    expect(nodeComponentRegistry.get('VisibleOnScreenNotifier3D')).toBe(VisibleOnScreenNotifier3D);
  });

  it('declares no render intent, as a node whose Godot gizmo is its only drawing', () => {
    expect(nodeComponentRegistry.renderIntentOf('VisibleOnScreenNotifier3D')).toBe('draws');
    expect(rendersOwnVisual('VisibleOnScreenNotifier3D')).toBe('draws');
  });
});
