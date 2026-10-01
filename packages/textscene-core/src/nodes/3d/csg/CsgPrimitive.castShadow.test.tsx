/**
 * `CSGShape3D : GeometryInstance3D` (`modules/csg/csg_shape.h:47`), so a CSG node carries
 * `cast_shadow` as a MeshInstance3D does: on the solid it draws alone and on the mesh a boolean
 * evaluates to.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CsgPrimitive, CSG_BOUNDS_PROXY } from './CsgPrimitive';
import './csgbox3d/index.r3f';
import './csgsphere3d/index.r3f';
import { parseCSGBox3D } from './csgbox3d/parser';
import { heading } from '../../../parser/testing/parserKit';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { clearEvaluationCache } from '../../../r3f/csg/csgEvaluationCache';
import { loadCsgModule } from '../../../r3f/csg/csgModule';
import { TscnParser } from '../../../parser/TscnParser';
import type { TscnNode } from '../../../parser/types';
import type { CSGBox3DProperties } from './csgbox3d/types';
import { findMesh } from '../testing/reactThreeTestInstance';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { parseTresFile } from '../../../parser/parsedResource';
import type { TscnInternalResource } from '../../../parser/types';
import { castsFrom, depthSideOf, drawsColour } from '../../../r3f/testing/threePasses';

function parseBox(properties: Record<string, string>): CSGBox3DProperties {
  return parseCSGBox3D(heading('CSGBox3D', { name: 'Box' }), properties);
}

/** The lone-root case: the node draws its own solid. */
async function renderLoneBox(
  properties: Record<string, string>,
  internalResources: TscnInternalResource[] = []
): Promise<THREE.Mesh> {
  const parsed = parseBox(properties);
  const node: TscnNode = { name: 'Box', type: 'CSGBox3D', children: [], properties: parsed };
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={internalResources}>
      <CsgPrimitive node={node} properties={parsed} />
    </SceneResourcesProvider>
  );
  return findMesh(renderer.scene) as unknown as THREE.Mesh;
}

function Tree({ node, path }: { node: TscnNode; path: string }) {
  const Component = nodeComponentRegistry.get(node.type)!;
  return (
    <NodePathProvider path={path}>
      <Component node={node}>
        {node.children.map((child) => (
          <Tree key={child.name} node={child} path={`${path}/${child.name}`} />
        ))}
      </Component>
    </NodePathProvider>
  );
}

/** The combining-root case: the drawn mesh is the evaluated boolean, not the own solid. */
async function renderSubtraction(rootProperties: string): Promise<THREE.Mesh> {
  clearEvaluationCache();
  const scene = new TscnParser().parse(
    `[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n\n` +
      `[node name="Block" type="CSGBox3D" parent="."]\nsize = Vector3(2, 2, 2)\n${rootProperties}\n\n` +
      `[node name="Hole" type="CSGSphere3D" parent="Block"]\n` +
      `transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1)\noperation = 2\nradius = 1.25\n`
  );
  const root = scene.nodes[0]!.children[0]!;
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={scene.internalResources}>
      <Tree node={root} path={`Root/${root.name}`} />
    </SceneResourcesProvider>
  );
  await loadCsgModule().catch(() => undefined);
  for (let attempt = 0; attempt < 20; attempt++) {
    await ReactThreeTestRenderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const hasProxy = renderer.scene
      .findAllByType('Mesh')
      .some((m) => (m.instance as THREE.Mesh).userData?.tscnBoundsProxy === true);
    if (hasProxy || attempt > 2) break;
  }
  const evaluated = renderer.scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .find((m) => m.userData?.tscnBoundsProxy !== CSG_BOUNDS_PROXY.tscnBoundsProxy);
  return evaluated!;
}

describe('CSG cast_shadow', () => {
  it('parses cast_shadow off every CSG primitive', () => {
    expect(parseBox({ cast_shadow: '2' }).castShadow).toBe(2);
    expect(parseBox({ cast_shadow: '0' }).castShadow).toBe(0);
    // Absent leaves it undefined; the mapper supplies Godot's ON default.
    expect(parseBox({}).castShadow).toBeUndefined();
  });

  it('a lone root with cast_shadow = OFF casts nothing', async () => {
    expect((await renderLoneBox({ cast_shadow: '0' })).castShadow).toBe(false);
  });

  it('a lone root casts by default', async () => {
    const mesh = await renderLoneBox({});
    expect(mesh.castShadow).toBe(true);
    expect(mesh.receiveShadow).toBe(true);
  });

  it('a lone root with cast_shadow = DOUBLE_SIDED draws both faces into the depth pass', async () => {
    expect(depthSideOf(await renderLoneBox({ cast_shadow: '2' }))).toBe(THREE.DoubleSide);
  });

  it('keeps the material’s own cull for every other cast_shadow value', async () => {
    // `render_forward_clustered.cpp:395-411`: only DOUBLE_SIDED drops the cull, and
    // every other value undoes three's acne flip (`WebGLShadowMap.js:51`).
    expect(depthSideOf(await renderLoneBox({}))).toBe(THREE.FrontSide);
    expect(depthSideOf(await renderLoneBox({ cast_shadow: '3' }))).toBe(THREE.FrontSide);
  });

  it('a lone root with cast_shadow = SHADOWS_ONLY casts but draws no colour', async () => {
    const mesh = await renderLoneBox({ cast_shadow: '3' });
    expect(mesh.castShadow).toBe(true);
    expect(drawsColour(mesh)).toBe(false);
  });

  it('a lone root with cast_shadow = SHADOWS_ONLY keeps its own surface material', async () => {
    const mesh = await renderLoneBox({ cast_shadow: '3' });
    expect((mesh.material as THREE.Material).colorWrite).toBe(true);
  });

  it('casts nothing from a lone root whose material leaves the shadow pass', async () => {
    const mesh = await renderLoneBox({ material: 'SubResource("Glass")' }, [
      { id: 'Glass', type: 'StandardMaterial3D', data: { transparency: '1' } },
    ]);
    expect(mesh.castShadow).toBe(true);
    expect(castsFrom(mesh)).toBe(false);
  });

  it('applies the root’s cast_shadow to the mesh a boolean evaluated to', async () => {
    expect((await renderSubtraction('cast_shadow = 0')).castShadow).toBe(false);
    expect(depthSideOf(await renderSubtraction('cast_shadow = 2'))).toBe(THREE.DoubleSide);
  });

  it('keeps a combining root’s evaluated mesh out of the colour pass for SHADOWS_ONLY', async () => {
    const mesh = await renderSubtraction('cast_shadow = 3');
    expect(mesh.castShadow).toBe(true);
    expect(drawsColour(mesh)).toBe(false);
  });

  it('keeps SHADOWS_ONLY once the node’s own material RESOLVES, not only at first mount', async () => {
    // An external `.tres` slot remounts when the file lands. SHADOWS_ONLY lives in the draw
    // hooks, not in the material, so the arrived material draws no colour either.
    const parsed = parseBox({ cast_shadow: '3', material: 'ExtResource("1_mat")' });
    const node: TscnNode = { name: 'Box', type: 'CSGBox3D', children: [], properties: parsed };
    const fake = createFakeResourceLoader();
    const tree = (
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={[]}
          externalResources={[{ id: '1_mat', path: 'res://paint.tres', type: 'StandardMaterial3D' }]}
        >
          <CsgPrimitive node={node} properties={parsed} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
    const renderer = await ReactThreeTestRenderer.create(tree);

    await ReactThreeTestRenderer.act(async () => {
      fake.resources._resolve(
        'res://paint.tres',
        parseTresFile(
          '[gd_resource type="StandardMaterial3D" format=3]\n\n[resource]\nalbedo_color = Color(1, 0, 0, 1)\n'
        )
      );
      await renderer.update(tree);
    });

    const mesh = findMesh(renderer.scene) as unknown as THREE.Mesh;
    const material = (Array.isArray(mesh.material) ? mesh.material[0]! : mesh.material)!;
    expect((material as THREE.MeshStandardMaterial).color.getHex()).toBe(0xff0000);
    expect(drawsColour(mesh)).toBe(false);
  });
});
