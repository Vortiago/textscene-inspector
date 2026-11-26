import { describe, expect, it } from 'vitest';
import { vulkanPointCoord } from './vulkanStage.js';

interface JoinedNode {
  readonly nodeType: string;
  readonly nodes: readonly { readonly op?: string }[];
}

describe('vulkanPointCoord', () => {
  it("is a vec2 of three's point UV with its y turned, so it starts at the top row", () => {
    const coord = vulkanPointCoord() as unknown as JoinedNode;

    expect([coord.nodeType, coord.nodes.length, coord.nodes[1]!.op]).toEqual(['vec2', 2, '-']);
  });

  it('builds a node of its own on each call', () => {
    expect(vulkanPointCoord()).not.toBe(vulkanPointCoord());
  });
});
