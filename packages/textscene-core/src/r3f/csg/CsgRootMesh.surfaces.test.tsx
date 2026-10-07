/**
 * A mounted CSG root whose evaluation gains a surface: each surface material must
 * bind at its own attach target, so `mesh.material` holds no hole.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { NodePathProvider } from '../contexts/NodePathContext';
import { TscnParser } from '../../parser/TscnParser';
import type { TscnNode } from '../../parser/types';
import { nodeComponentRegistry } from '../NodeComponentRegistry';
import { clearEvaluationCache } from './csgEvaluationCache';
import { loadCsgModule } from './csgModule';
import '../nodes/index';

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

function scene(body: string) {
  const parsed = new TscnParser().parse(`[gd_scene format=3]\n\n${body}\n`);
  const root = parsed.nodes[0]!.children[0]!;
  return (
    <SceneResourcesProvider internalResources={parsed.internalResources}>
      <Tree node={root} path={`Root/${root.name}`} />
    </SceneResourcesProvider>
  );
}

/** Lets the library's dynamic import and the evaluation's state update land. */
async function settle(): Promise<void> {
  await loadCsgModule();
  for (let tick = 0; tick < 5; tick++) {
    await ReactThreeTestRenderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

const MATERIALS = `[sub_resource type="StandardMaterial3D" id="Red"]
albedo_color = Color(1, 0, 0, 1)

[sub_resource type="StandardMaterial3D" id="Blue"]
albedo_color = Color(0, 0, 1, 1)
`;

/** Two contributors: one surface while both share a material, two once they differ. */
function block(secondMaterial: string): string {
  return `[node name="Root" type="Node3D"]

[node name="Block" type="CSGCombiner3D" parent="."]

[node name="Left" type="CSGBox3D" parent="Block"]
material = SubResource("Red")

[node name="Right" type="CSGBox3D" parent="Block"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 3, 0, 0)
material = SubResource("${secondMaterial}")
`;
}

/** The root's drawn mesh: the one mesh that is not a contributor's invisible bounds proxy. */
function drawnMesh(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>): THREE.Mesh {
  return renderer.scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .find((mesh) => mesh.visible)!;
}

describe('<CsgRootMesh> surface slots', () => {
  it('binds every surface material when its contributors stop sharing one', async () => {
    clearEvaluationCache();
    const renderer = await ReactThreeTestRenderer.create(scene(MATERIALS + block('Red')));
    await settle();

    await renderer.update(scene(MATERIALS + block('Blue')));
    await settle();

    const materials = drawnMesh(renderer).material as THREE.MeshStandardMaterial[];
    const colours = materials.map((m) => m?.color.getHex());
    expect(colours.sort((a, b) => a! - b!)).toEqual([0x0000ff, 0xff0000]);
  });
});
