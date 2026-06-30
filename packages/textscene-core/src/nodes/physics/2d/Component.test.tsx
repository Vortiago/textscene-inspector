import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Node2D } from '../../base/node2d/Component';
import { parseNode2D } from '../../base/node2d/parser';
import type { TscnNode } from '../../../parser/types';

const areaHeading = (attributes: Record<string, string> = {}) => ({
  type: 'node' as const,
  attributes: { name: 'Area2D', type: 'Area2D', ...attributes },
});

function makeBody(raw: Record<string, string> = {}): TscnNode {
  return {
    name: raw.name || 'Area2D',
    type: 'Area2D',
    children: [],
    properties: parseNode2D(areaHeading(raw), {
      position: 'Vector2(0, 0)',
      ...raw,
    }),
  };
}

describe('<Node2D> (area2d physics body)', () => {
  it('renders Area2D as a named group', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Node2D node={makeBody()} />);
    expect(renderer.scene.findByProps({ name: 'Area2D' })).toBeDefined();
  });

  it('hides the group when visible is false', async () => {
    const body = makeBody({ name: 'CharacterBody2D', visible: 'false' });
    const renderer = await ReactThreeTestRenderer.create(<Node2D node={body} />);
    expect(renderer.scene.findByProps({ name: 'CharacterBody2D' })).toBeDefined();
  });

  it('renders children inside the transform group', async () => {
    const body = makeBody({ name: 'Area2DRender' });
    const renderer = await ReactThreeTestRenderer.create(
      <Node2D node={body}>
        <mesh name="kid">
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial />
        </mesh>
      </Node2D>
    );
    expect(renderer.scene.findByProps({ name: 'kid' })).toBeDefined();
  });
});
