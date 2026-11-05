/**
 * three sorts a mesh by the `renderOrder` of its nearest enclosing group, so every group inside a
 * canvas item carries the item's key, and a group given its own key hands it to the groups inside.
 */
import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CanvasItemGroup, CanvasItemProvider, useCanvasItemOrigin } from './CanvasItemGroup';

async function innerGroupOrder(tree: React.ReactNode): Promise<number> {
  const renderer = await ReactThreeTestRenderer.create(tree);
  const inner = renderer.scene.findAll((node) => node.props.name === 'inner')[0]!;
  return (inner.instance as THREE.Group).renderOrder;
}

describe('<CanvasItemGroup>', () => {
  it("carries the enclosing canvas item's key", async () => {
    const order = await innerGroupOrder(
      <CanvasItemProvider value={7}>
        <CanvasItemGroup name="inner" />
      </CanvasItemProvider>
    );
    expect(order).toBe(7);
  });

  it('hands its own renderOrder to the groups inside it', async () => {
    const order = await innerGroupOrder(
      <CanvasItemProvider value={7}>
        <CanvasItemGroup renderOrder={12}>
          <CanvasItemGroup name="inner" />
        </CanvasItemGroup>
      </CanvasItemProvider>
    );
    expect(order).toBe(12);
  });

  it('carries key 0 outside any canvas item', async () => {
    expect(await innerGroupOrder(<CanvasItemGroup name="inner" />)).toBe(0);
  });
});

/** Renders `useCanvasItemOrigin` where the tree places the probe. */
async function originAtProbe(
  tree: (probe: React.ReactNode) => React.ReactNode
): Promise<{ x: number; y: number }> {
  let seen = { x: Number.NaN, y: Number.NaN };
  function Probe() {
    seen = useCanvasItemOrigin();
    return null;
  }
  await ReactThreeTestRenderer.create(<>{tree(<Probe />)}</>);
  return seen;
}

describe('useCanvasItemOrigin', () => {
  it('sums the positions of the groups inside the item, in Godot px with +Y down', async () => {
    const origin = await originAtProbe((probe) => (
      <CanvasItemProvider value={0}>
        <CanvasItemGroup position={[2.25, -1.5, 0]}>
          <CanvasItemGroup position={[0.5, -0.25, 0]}>{probe}</CanvasItemGroup>
        </CanvasItemGroup>
      </CanvasItemProvider>
    ));
    expect(origin).toEqual({ x: 2.75, y: 1.75 });
  });

  it('starts again at a nested item, whose own group carries its place', async () => {
    const origin = await originAtProbe((probe) => (
      <CanvasItemProvider value={0}>
        <CanvasItemGroup position={[3, -3, 0]}>
          <CanvasItemProvider value={1}>
            <CanvasItemGroup position={[0.5, -0.5, 0]}>{probe}</CanvasItemGroup>
          </CanvasItemProvider>
        </CanvasItemGroup>
      </CanvasItemProvider>
    ));
    expect(origin).toEqual({ x: 0.5, y: 0.5 });
  });
});
