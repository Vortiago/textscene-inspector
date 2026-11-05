/**
 * A CPUParticles2D whose texture is a CanvasTexture: it declares itself normal-mapped while the
 * CanvasTexture names a normal map (`canvas.glsl:652-665`), samples with the CanvasTexture's own
 * filter (`texture_storage.cpp:737`), and turns the normal with the basis it draws at. A
 * global-coords emitter draws at the canvas transform (`renderer_canvas_cull.cpp:267`).
 */
import { beforeAll, describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { parseCPUParticles2D } from './parser';
import { CPUParticles2D } from './Component';
import { loadSimulate } from './simulateModule';
import { CanvasWorkspaceProvider } from '../../../r3f/contexts/CanvasWorkspaceContext';
import {
  CANVAS_TEXTURE_REF,
  FLAT_GREY_REF,
  canvasTexture,
  renderLitItem,
} from '../../../r3f/testing/canvasTextureLighting';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';

const QUARTER_TURN = '1.5707964';

function emitter(raw: Record<string, string> = {}): TscnNode {
  const heading = { type: 'node', attributes: { type: 'CPUParticles2D', name: 'Fx' } };
  return {
    rawProperties: {},
    name: 'Fx',
    type: 'CPUParticles2D',
    children: [],
    properties: parseCPUParticles2D(heading, {
      texture: CANVAS_TEXTURE_REF,
      amount: '1',
      explosiveness: '1',
      gravity: 'Vector2(0, 0)',
      ...raw,
    }),
  };
}

async function render(wrapper: TscnInternalResource, raw: Record<string, string> = {}) {
  const { renderer, registerItem } = await renderLitItem(
    <CanvasWorkspaceProvider workspace="2d">
      <CPUParticles2D node={emitter(raw)} />
    </CanvasWorkspaceProvider>,
    [wrapper]
  );
  const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
  return { registerItem, mesh, map: (mesh.material as THREE.MeshBasicMaterial).map! };
}

/** Updates every world matrix from the root, as a render does: the mesh's own matrix is fixed. */
function updateWorldMatrices(mesh: THREE.Mesh): void {
  let root: THREE.Object3D = mesh;
  while (root.parent) root = root.parent;
  root.updateMatrixWorld();
}

/** The x axis the mesh draws at, in three's y-up frame: what turns the normal (`canvas.glsl:708`). */
function drawnXAxis(mesh: THREE.Mesh): THREE.Vector3 {
  updateWorldMatrices(mesh);
  return new THREE.Vector3().setFromMatrixColumn(mesh.matrixWorld, 0).normalize();
}

// The component loads this chunk lazily, so it lands before the first render.
beforeAll(loadSimulate);

describe('CPUParticles2D with a CanvasTexture', () => {
  it('declares itself normal-mapped while the CanvasTexture names a normal map', async () => {
    const { registerItem } = await render(canvasTexture({ normal_texture: FLAT_GREY_REF }));
    expect(registerItem).toHaveBeenLastCalledWith(expect.anything(), 'apart');
  });

  it('declares no normal map while the CanvasTexture names none', async () => {
    const { registerItem } = await render(canvasTexture({}));
    expect(registerItem).toHaveBeenLastCalledWith(expect.anything(), 'plain');
  });

  it("samples the diffuse with the CanvasTexture's own filter", async () => {
    const { map } = await render(canvasTexture({ texture_filter: '1' }));
    expect([map.magFilter, map.minFilter]).toEqual([THREE.NearestFilter, THREE.NearestFilter]);
  });
});

describe('the basis a CPUParticles2D draws at', () => {
  it('is the canvas transform for a global-coords emitter, whatever its rotation', async () => {
    const { mesh } = await render(canvasTexture({}), { rotation: QUARTER_TURN, local_coords: 'false' });
    const axis = drawnXAxis(mesh);
    expect(axis.x).toBeCloseTo(1, 5);
    expect(axis.y).toBeCloseTo(0, 5);
  });

  it("is the emitter's own for a local-coords emitter", async () => {
    const { mesh } = await render(canvasTexture({}), { rotation: QUARTER_TURN, local_coords: 'true' });
    const axis = drawnXAxis(mesh);
    // Godot's clockwise quarter turn is three's -y in the y-up frame.
    expect(axis.x).toBeCloseTo(0, 5);
    expect(axis.y).toBeCloseTo(-1, 5);
  });

  it('places a global-coords particle where its emitter spawns it', async () => {
    const { mesh } = await render(canvasTexture({}), {
      rotation: QUARTER_TURN,
      position: 'Vector2(30, 40)',
      local_coords: 'false',
    });
    updateWorldMatrices(mesh);
    mesh.geometry.computeBoundingBox();
    const centre = mesh.geometry.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
    expect(centre.x).toBeCloseTo(30, 3);
    expect(centre.y).toBeCloseTo(-40, 3);
  });
});
