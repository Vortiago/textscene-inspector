/**
 * Strict-verification harness (WI-R3F-9, group K) — fallback assertions.
 *
 * Assertion 95 (userData carries nodeType/nodeName) still holds. Assertion 96
 * ("fallback is visible — non-zero placeholder mesh") is SUPERSEDED by ADR-0008:
 * the fallback now renders an invisible transform-only group with no placeholder
 * mesh, so unsupported types don't clutter the viewport.
 */

import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { GenericNodeFallback } from './Component';
import type { TscnNode } from '../../../parser/types';

const node: TscnNode = {
  name: 'MysteryThing',
  type: 'SomeUnregisteredType',
  children: [],
  properties: {},
};

describe('GenericNodeFallback (ADR-0008 invisible render intent)', () => {
  it('#95 unregistered node type → userData carries nodeType + nodeName', async () => {
    const renderer = await ReactThreeTestRenderer.create(<GenericNodeFallback node={node} />);
    const group = renderer.scene.findByProps({ name: 'MysteryThing' });
    const userData = group.instance.userData as {
      isPlaceholder: boolean;
      nodeType: string;
      nodeName: string;
    };
    expect(userData.isPlaceholder).toBe(true);
    expect(userData.nodeType).toBe('SomeUnregisteredType');
    expect(userData.nodeName).toBe('MysteryThing');
  });

  it('#96 (superseded by ADR-0008) fallback draws no placeholder mesh — invisible group', async () => {
    const renderer = await ReactThreeTestRenderer.create(<GenericNodeFallback node={node} />);
    expect(renderer.scene.findAllByType('Mesh').length).toBe(0);
    expect(renderer.scene.findByProps({ name: 'MysteryThing' })).toBeDefined();
  });
});
