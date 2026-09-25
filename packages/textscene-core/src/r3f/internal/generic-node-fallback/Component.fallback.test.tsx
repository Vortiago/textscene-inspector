/**
 * The fallback carries `nodeType` and `nodeName` in userData and, per ADR-0008, renders an
 * invisible transform-only group with no placeholder mesh.
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
