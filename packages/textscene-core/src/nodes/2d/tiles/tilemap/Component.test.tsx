import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import { parseTileMap } from './parser';
import { TileMap } from './Component';

const baseNode: TscnNode = {
  name: 'MyTileMap',
  type: 'TileMap',
  children: [],
  properties: parseTileMap({ type: 'node', attributes: { type: 'TileMap', name: 'MyTileMap' } }, {}),
};

describe('<TileMap>', () => {
  it('renders a group', async () => {
    const renderer = await ReactThreeTestRenderer.create(<TileMap node={baseNode} />);
    expect(renderer.scene.findAllByType('Group').length).toBeGreaterThan(0);
  });

  it('renders children inside the group', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TileMap node={baseNode}>
        <mesh name="child">
          <boxGeometry />
          <meshBasicMaterial />
        </mesh>
      </TileMap>
    );
    expect(renderer.scene.findByProps({ name: 'child' })).toBeDefined();
  });
});
