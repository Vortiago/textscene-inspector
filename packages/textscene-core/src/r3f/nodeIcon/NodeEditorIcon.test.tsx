/**
 * The icon a node draws in the 3D viewport. Godot's gizmo plugins add it for every node outside any
 * selection check, dimmed when the node is not selected, and the Gizmos toggle hides it
 * (`node_3d_editor_gizmos.cpp:949-985`, `camera_3d_gizmo_plugin.cpp:259`).
 */

import { beforeAll, describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../parser/types';
import { nodeComponentRegistry } from '../NodeComponentRegistry';
import { GizmoScene } from '../testing/GizmoScene';
import { isNodeIcon } from '../editorHelpers';
import { NodeEditorIcon } from './NodeEditorIcon';

const Dummy = () => null;

const ICON_TYPE = '__TestIconNode';
const TINTED_TYPE = '__TestTintedIconNode';
const HIDDEN_TYPE = '__TestHiddenIconNode';
const PLAIN_TYPE = '__TestPlainNode';

function node(type: string, properties: Record<string, unknown> = {}): TscnNode {
  return { name: 'Node', type, properties, children: [] } as unknown as TscnNode;
}

beforeAll(() => {
  nodeComponentRegistry.register({
    typeName: ICON_TYPE,
    Component: Dummy,
    editorIcon: { icon: 'GizmoCamera3D' },
  });
  nodeComponentRegistry.register({
    typeName: TINTED_TYPE,
    Component: Dummy,
    editorIcon: { icon: 'GizmoLight', modulate: () => ({ r: 1, g: 0.5, b: 0.5, a: 1 }) },
  });
  nodeComponentRegistry.register({
    typeName: HIDDEN_TYPE,
    Component: Dummy,
    editorIcon: { icon: 'GizmoFogVolume', isDrawn: () => false },
  });
  nodeComponentRegistry.register({ typeName: PLAIN_TYPE, Component: Dummy });
});

async function render(
  type: string,
  options: { selectedPath?: string | null; showGizmos?: boolean; instantiated?: boolean } = {}
) {
  const { selectedPath = null, showGizmos, instantiated } = options;
  const renderer = await ReactThreeTestRenderer.create(
    <GizmoScene
      nodePath="Node"
      selectedPath={selectedPath}
      showGizmos={showGizmos}
      instantiated={instantiated}
    >
      <NodeEditorIcon node={node(type)} />
    </GizmoScene>
  );
  return renderer.scene.findAllByType('Mesh').map((mesh) => mesh.instance as THREE.Mesh);
}

function materialOf(mesh: THREE.Mesh): THREE.MeshBasicMaterial {
  return mesh.material as THREE.MeshBasicMaterial;
}

describe('NodeEditorIcon', () => {
  it('draws one quad for a node that is not selected', async () => {
    expect(await render(ICON_TYPE)).toHaveLength(1);
  });

  it('draws one quad for the selected node', async () => {
    expect(await render(ICON_TYPE, { selectedPath: 'Node' })).toHaveLength(1);
  });

  it('draws a selected icon in its own colours', async () => {
    const [mesh] = await render(ICON_TYPE, { selectedPath: 'Node' });
    expect(materialOf(mesh!).color.toArray()).toEqual([1, 1, 1]);
  });

  it('multiplies the colour of an unselected icon by 0.6 in sRGB', async () => {
    const [mesh] = await render(ICON_TYPE);
    expect(materialOf(mesh!).color.toArray()).toEqual(
      [0.3185468, 0.3185468, 0.3185468].map((c) => expect.closeTo(c, 6))
    );
  });

  it('tints a selected icon with the modulate of its registration', async () => {
    const [mesh] = await render(TINTED_TYPE, { selectedPath: 'Node' });
    expect(materialOf(mesh!).color.toArray()).toEqual(
      [1, 0.2140411, 0.2140411].map((c) => expect.closeTo(c, 6))
    );
  });

  it('draws the icon in the instantiated grey inside an instance the edited scene does not own', async () => {
    const [mesh] = await render(ICON_TYPE, { selectedPath: 'Node', instantiated: true });
    expect(materialOf(mesh!).color.toArray()).toEqual(
      [0.4479884, 0.4479884, 0.4479884].map((c) => expect.closeTo(c, 6))
    );
  });

  it('draws an unshaded quad with an alpha scissor of 0.1 and no fog', async () => {
    const [mesh] = await render(ICON_TYPE);
    const material = materialOf(mesh!);
    expect([material.alphaTest, material.fog, material.transparent, material.map?.colorSpace]).toEqual([
      0.1,
      false,
      false,
      THREE.SRGBColorSpace,
    ]);
  });

  it('samples the icon texture without mipmaps, as the editor uploads it', async () => {
    const [mesh] = await render(ICON_TYPE);
    const texture = materialOf(mesh!).map!;
    expect([texture.generateMipmaps, texture.minFilter, texture.magFilter]).toEqual([
      false,
      THREE.LinearFilter,
      THREE.LinearFilter,
    ]);
  });

  it('shares one texture between the icons of one type', async () => {
    const [first] = await render(ICON_TYPE);
    const [second] = await render(ICON_TYPE, { selectedPath: 'Node' });
    expect(materialOf(first!).map).toBe(materialOf(second!).map);
  });

  it('tags the quad as a node icon, which no bounds include', async () => {
    const [mesh] = await render(ICON_TYPE);
    expect(isNodeIcon(mesh!)).toBe(true);
  });

  it('draws nothing with the Gizmos toggle off', async () => {
    expect(await render(ICON_TYPE, { selectedPath: 'Node', showGizmos: false })).toHaveLength(0);
  });

  it('draws nothing for a node whose registration says Godot adds no icon', async () => {
    expect(await render(HIDDEN_TYPE)).toHaveLength(0);
  });

  it('draws nothing for a type that registers no icon', async () => {
    expect(await render(PLAIN_TYPE)).toHaveLength(0);
  });
});
