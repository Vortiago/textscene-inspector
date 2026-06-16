import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import { parseTileMapLayer } from './parser';
import { TileMapLayer } from './Component';

const heading = { type: 'node', attributes: { type: 'TileMapLayer', name: 'MyTileMapLayer' } };

function makeNode(raw: Record<string, string> = {}): TscnNode {
  return {
    name: 'MyTileMapLayer',
    type: 'TileMapLayer',
    children: [],
    properties: parseTileMapLayer(heading, raw),
  };
}

describe('<TileMapLayer>', () => {
  it('renders a group', async () => {
    const renderer = await ReactThreeTestRenderer.create(<TileMapLayer node={makeNode()} />);
    expect(renderer.scene.findAllByType('Group').length).toBeGreaterThan(0);
  });

  it('renders children inside the group', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TileMapLayer node={makeNode()}>
        <mesh name="child">
          <boxGeometry />
          <meshBasicMaterial />
        </mesh>
      </TileMapLayer>
    );
    expect(renderer.scene.findByProps({ name: 'child' })).toBeDefined();
  });
});
