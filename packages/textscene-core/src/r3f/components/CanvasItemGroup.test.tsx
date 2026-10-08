/**
 * three sorts a mesh by the `renderOrder` of its nearest enclosing group, so every group inside a
 * canvas item carries the item's key, and a group given its own key hands it to the groups inside.
 */
import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CanvasItemGroup, CanvasItemKeyProvider } from './CanvasItemGroup';

async function innerGroupOrder(tree: React.ReactNode): Promise<number> {
  const renderer = await ReactThreeTestRenderer.create(tree);
  const inner = renderer.scene.findAll((node) => node.props.name === 'inner')[0]!;
  return (inner.instance as THREE.Group).renderOrder;
}

describe('<CanvasItemGroup>', () => {
  it("carries the enclosing canvas item's key", async () => {
    const order = await innerGroupOrder(
      <CanvasItemKeyProvider value={7}>
        <CanvasItemGroup name="inner" />
      </CanvasItemKeyProvider>
    );
    expect(order).toBe(7);
  });

  it('hands its own renderOrder to the groups inside it', async () => {
    const order = await innerGroupOrder(
      <CanvasItemKeyProvider value={7}>
        <CanvasItemGroup renderOrder={12}>
          <CanvasItemGroup name="inner" />
        </CanvasItemGroup>
      </CanvasItemKeyProvider>
    );
    expect(order).toBe(12);
  });

  it('carries key 0 outside any canvas item', async () => {
    expect(await innerGroupOrder(<CanvasItemGroup name="inner" />)).toBe(0);
  });
});
