import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Node2D } from '../../base/node2d/Component';
import { parseNode2D } from '../../base/node2d/parser';
import { useParentModulate } from '../../../r3f/canvasItemModulate';
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
  it('renders Area2D as a named, visible group', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Node2D node={makeBody()} />);
    const group = renderer.scene.findByProps({ name: 'Area2D' });
    expect(group.instance.visible).toBe(true);
  });

  it('hides the group when visible is false', async () => {
    const body = makeBody({ name: 'CharacterBody2D', visible: 'false' });
    const renderer = await ReactThreeTestRenderer.create(<Node2D node={body} />);
    const group = renderer.scene.findByProps({ name: 'CharacterBody2D' });
    expect(group.instance.visible).toBe(false);
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

  it("cascades a StaticBody2D's modulate down to a nested child (Modulate2DContext)", async () => {
    function ModulateReader() {
      const modulate = useParentModulate();
      return <mesh name="modulate-reader" userData={{ modulate }} />;
    }
    const body = makeBody({ name: 'TintedStaticBody2D', modulate: 'Color(0.5, 0.25, 1, 0.8)' });
    const renderer = await ReactThreeTestRenderer.create(
      <Node2D node={body}>
        <ModulateReader />
      </Node2D>
    );
    const reader = renderer.scene.findByProps({ name: 'modulate-reader' });
    expect(reader.instance.userData.modulate).toEqual({ r: 0.5, g: 0.25, b: 1, a: 0.8 });
  });
});
