/**
 * The icon a node draws in the 3D viewport. Godot's gizmo plugins add it for every node outside any
 * selection check, dimmed when the node is not selected, and the Gizmos toggle hides it
 * (`node_3d_editor_gizmos.cpp:949-985`, `camera_3d_gizmo_plugin.cpp:259`).
 */

import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../parser/types';
import { GizmoScene } from '../testing/GizmoScene';
import { isNodeIcon } from '../editorHelpers';
import type { EditorIconRegistration } from './editorIconRegistration';
import { NodeEditorIcon } from './NodeEditorIcon';

const CAMERA_ICON: EditorIconRegistration = { icon: 'GizmoCamera3D' };
const TINTED_ICON: EditorIconRegistration = {
  icon: 'GizmoLight',
  modulate: () => ({ r: 1, g: 0.5, b: 0.5, a: 1 }),
};
const HIDDEN_ICON: EditorIconRegistration = { icon: 'GizmoFogVolume', isDrawn: () => false };

const NODE = { name: 'Node', type: 'Node3D', properties: {}, children: [] } as unknown as TscnNode;

async function render(
  registration: EditorIconRegistration | EditorIconRegistration[],
  options: { selectedPath?: string | null; showGizmos?: boolean; instantiated?: boolean } = {}
) {
  const { selectedPath = null, showGizmos, instantiated } = options;
  const registrations = [registration].flat();
  const renderer = await ReactThreeTestRenderer.create(
    <GizmoScene
      nodePath="Node"
      selectedPath={selectedPath}
      showGizmos={showGizmos}
      instantiated={instantiated}
    >
      {registrations.map((each, index) => (
        <NodeEditorIcon key={index} node={NODE} registration={each} />
      ))}
    </GizmoScene>
  );
  return renderer.scene.findAllByType('Mesh').map((mesh) => mesh.instance as THREE.Mesh);
}

function materialOf(mesh: THREE.Mesh): THREE.MeshBasicMaterial {
  return mesh.material as THREE.MeshBasicMaterial;
}

describe('NodeEditorIcon', () => {
  it('draws one quad for a node that is not selected', async () => {
    expect(await render(CAMERA_ICON)).toHaveLength(1);
  });

  it('draws one quad for the selected node', async () => {
    expect(await render(CAMERA_ICON, { selectedPath: 'Node' })).toHaveLength(1);
  });

  it('dims an unselected icon, which is the look the gate gives it', async () => {
    const [mesh] = await render(CAMERA_ICON);
    expect(materialOf(mesh!).color.toArray()).toEqual(
      [0.3185468, 0.3185468, 0.3185468].map((c) => expect.closeTo(c, 6))
    );
  });

  it('draws the instantiated grey inside an instance the edited scene does not own', async () => {
    const [mesh] = await render(CAMERA_ICON, { selectedPath: 'Node', instantiated: true });
    expect(materialOf(mesh!).color.toArray()).toEqual(
      [0.4479884, 0.4479884, 0.4479884].map((c) => expect.closeTo(c, 6))
    );
  });

  it('tints a selected icon with the modulate of its registration', async () => {
    const [mesh] = await render(TINTED_ICON, { selectedPath: 'Node' });
    expect(materialOf(mesh!).color.toArray()).toEqual(
      [1, 0.2140411, 0.2140411].map((c) => expect.closeTo(c, 6))
    );
  });

  it('draws an unshaded quad with an alpha scissor of 0.1 and no fog', async () => {
    const [mesh] = await render(CAMERA_ICON);
    const material = materialOf(mesh!);
    expect([material.alphaTest, material.fog, material.transparent, material.map?.colorSpace]).toEqual([
      0.1,
      false,
      false,
      THREE.SRGBColorSpace,
    ]);
  });

  it('samples the icon texture without mipmaps, as the editor uploads it', async () => {
    const [mesh] = await render(CAMERA_ICON);
    const texture = materialOf(mesh!).map!;
    expect([texture.generateMipmaps, texture.minFilter, texture.magFilter]).toEqual([
      false,
      THREE.LinearFilter,
      THREE.LinearFilter,
    ]);
  });

  it('shares one texture between the icons of one type', async () => {
    const [first] = await render(CAMERA_ICON);
    const [second] = await render(CAMERA_ICON, { selectedPath: 'Node' });
    expect(materialOf(first!).map).toBe(materialOf(second!).map);
  });

  it('draws icons of one look through one material', async () => {
    const [first, second] = await render([CAMERA_ICON, CAMERA_ICON]);
    expect(materialOf(first!)).toBe(materialOf(second!));
  });

  it('draws icons of two looks through two materials', async () => {
    const [plain, tinted] = await render([CAMERA_ICON, TINTED_ICON]);
    expect(materialOf(plain!)).not.toBe(materialOf(tinted!));
  });

  it('tags the quad as a node icon, which no bounds include', async () => {
    const [mesh] = await render(CAMERA_ICON);
    expect(isNodeIcon(mesh!)).toBe(true);
  });

  it('draws nothing with the Gizmos toggle off', async () => {
    expect(await render(CAMERA_ICON, { selectedPath: 'Node', showGizmos: false })).toHaveLength(0);
  });

  it('draws nothing for a node whose registration says Godot adds no icon', async () => {
    expect(await render(HIDDEN_ICON)).toHaveLength(0);
  });
});
