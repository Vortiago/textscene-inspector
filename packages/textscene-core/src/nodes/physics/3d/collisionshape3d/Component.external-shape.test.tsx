/**
 * CollisionShape2D/3D `shape` accepts an ExtResource `.tres`, not only an
 * inline SubResource.
 *
 * `resolveSubResourceRef` returns undefined for the ExtResource form, so the
 * gizmo rendered nothing at all — silently, since the `warn` fallback inside
 * CollisionGizmo is only reached once a resource exists. Three vendored physics
 * scenes reference `godot3_robot_head_collision.tres` that way.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CollisionShape3D } from './Component';
import { CollisionShape2D } from '../../2d/collisionshape2d/Component';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { ViewportModeProvider } from '../../../../r3f/contexts/ViewportModeContext';
import { ResourceLoaderProvider } from '../../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';
import type { ParsedResource } from '../../../../parser/parsedResource';
import { TscnParser } from '../../../../parser/TscnParser';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../../parser/types';

const SHAPE_PATH = 'res://robot_head_collision.tres';

const EXTERNALS: readonly TscnExternalResource[] = [
  { id: '1', path: SHAPE_PATH, type: 'Shape3D' },
];

const INLINE_BOX: readonly TscnInternalResource[] = [
  { id: 'Box_inline', type: 'BoxShape3D', data: { size: 'Vector3(3, 4, 5)' } },
];

/** A .tres carrying a BoxShape3D, as the resource pipeline would parse it. */
const BOX_TRES: ParsedResource = {
  resourceType: 'BoxShape3D',
  properties: { size: 'Vector3(2, 6, 8)' },
  extResources: [],
  subResources: [],
};

/** Build through the real parser so each slice gets the property shape it expects. */
function node(type: string, shape: string | undefined): TscnNode {
  const body = shape === undefined ? '' : `shape = ${shape}\n`;
  const scene = new TscnParser().parse(
    `[gd_scene format=3]\n\n[node name="My${type}" type="${type}"]\n${body}`
  );
  return scene.nodes[0];
}

async function render3D(shape: string | undefined, tres?: ParsedResource) {
  const fake = createFakeResourceLoader();
  if (tres) fake.resources.seed(SHAPE_PATH, tres);
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <ViewportModeProvider initialShowCollisions>
        <SceneResourcesProvider internalResources={INLINE_BOX} externalResources={EXTERNALS}>
          <CollisionShape3D node={node('CollisionShape3D', shape)} />
        </SceneResourcesProvider>
      </ViewportModeProvider>
    </ResourceLoaderProvider>
  );
}

function boxSize(renderer: Awaited<ReturnType<typeof render3D>>) {
  const geometry = renderer.scene.findByType('Mesh').instance.geometry as unknown as {
    parameters: { width: number; height: number; depth: number };
  };
  return [geometry.parameters.width, geometry.parameters.height, geometry.parameters.depth];
}

describe('<CollisionShape3D> shape resolution', () => {
  it('draws the gizmo for a shape loaded from an ExtResource .tres', async () => {
    const renderer = await render3D('ExtResource("1")', BOX_TRES);
    expect(boxSize(renderer)).toEqual([2, 6, 8]);
  });

  it('still resolves an inline SubResource shape', async () => {
    const renderer = await render3D('SubResource("Box_inline")');
    expect(boxSize(renderer)).toEqual([3, 4, 5]);
  });

  it('draws nothing while the .tres is still loading', async () => {
    const renderer = await render3D('ExtResource("1")');
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('draws nothing when no shape is declared', async () => {
    const renderer = await render3D(undefined);
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });
});

describe('<CollisionShape2D> shape resolution', () => {
  it('draws the gizmo for a shape loaded from an ExtResource .tres', async () => {
    const fake = createFakeResourceLoader();
    fake.resources.seed(SHAPE_PATH, {
      resourceType: 'RectangleShape2D',
      properties: { size: 'Vector2(40, 20)' },
      extResources: [],
      subResources: [],
    });
    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={fake.loader}>
        <ViewportModeProvider initialShowCollisions>
          <SceneResourcesProvider internalResources={[]} externalResources={EXTERNALS}>
            <CollisionShape2D node={node('CollisionShape2D', 'ExtResource("1")')} />
          </SceneResourcesProvider>
        </ViewportModeProvider>
      </ResourceLoaderProvider>
    );
    expect(renderer.scene.findAllByType('LineSegments').length).toBeGreaterThan(0);
  });
});
