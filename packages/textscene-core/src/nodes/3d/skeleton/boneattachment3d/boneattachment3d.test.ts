/**
 * BoneAttachment3D registration: its own parse reads the five seat properties, and the component
 * seats the node on its bone through the live scene pass (ADR-0060). It drives other nodes, so it
 * registers `transform-only` with `scenePass`, and draws nothing itself.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { parseBoneAttachment3D } from './parser';
import { BoneAttachment3D } from './Component';
import './index';
import './index.r3f';

describe('BoneAttachment3D registration', () => {
  it('registers the parse that reads its five own properties', () => {
    const registration = nodeRegistry.getRegistration('BoneAttachment3D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseBoneAttachment3D);
  });

  it('registers the seat component, which draws nothing of its own', () => {
    expect(nodeComponentRegistry.get('BoneAttachment3D')).toBe(BoneAttachment3D);
  });

  it('registers `transform-only`, so its own geometry stays unseen (ADR-0008)', () => {
    expect(nodeComponentRegistry.renderIntentOf('BoneAttachment3D')).toBe('transform-only');
  });

  it('declares the scene pass that seats every node by its live path (ADR-0060)', () => {
    expect(nodeComponentRegistry.scenePassTypeNames().has('BoneAttachment3D')).toBe(true);
  });
});
