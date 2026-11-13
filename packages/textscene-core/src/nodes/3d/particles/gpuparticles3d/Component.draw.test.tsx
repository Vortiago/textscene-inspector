/**
 * What <GPUParticles3D> hands three: each draw pass an instanced draw over the settled particles,
 * posed and coloured as the GPU writes them.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';
import type { TscnInternalResource } from '../../../../parser/types';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { registeredComponent } from '../../../../r3f/testing/registeredComponent';
import { ResourceLoaderProvider } from '../../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';
import { loadParticleEmitter } from './emitterModule';
import { ALONG_X, BOX, emitterNode, ROW_OF_FOUR, SPHERE } from './gpuparticles3d.testkit';
import './index.r3f';

const GPUParticles3D = registeredComponent('GPUParticles3D');

const OVERLAY: TscnInternalResource = { id: 'Overlay', type: 'StandardMaterial3D', data: {} };
const SHADER: TscnInternalResource = { id: 'Shader', type: 'ShaderMaterial', data: {} };

function emitter(properties: Record<string, string>) {
  return (
    <ResourceLoaderProvider loader={createFakeResourceLoader().loader}>
      <SceneResourcesProvider
        internalResources={[ALONG_X, BOX, SPHERE, OVERLAY, SHADER]}
        externalResources={[]}
      >
        <GPUParticles3D node={emitterNode(properties)} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

const meshesOf = async (properties: Record<string, string>) =>
  (await ReactThreeTestRenderer.create(emitter(properties))).scene
    .findAll((node) => node.type === 'Mesh')
    .map((node) => node.instance as THREE.InstancedMesh);

// The component loads this chunk lazily, so it lands before the first render.
beforeAll(loadParticleEmitter);

describe('<GPUParticles3D> draw', () => {
  it('draws one instance of the mesh for each live particle', async () => {
    const [drawn] = await meshesOf(ROW_OF_FOUR);
    expect(drawn!.count).toBe(4);
  });

  // Each particle is born half a second after the one before, and flies at one unit a second.
  it("places each instance at its particle's origin", async () => {
    const [drawn] = await meshesOf(ROW_OF_FOUR);
    const xs = [0, 1, 2, 3].map((i) => {
      const matrix = new THREE.Matrix4();
      drawn!.getMatrixAt(i, matrix);
      return new THREE.Vector3().setFromMatrixPosition(matrix).x;
    });
    const gaps = [xs[0]! - xs[1]!, xs[1]! - xs[2]!, xs[2]! - xs[3]!];
    gaps.forEach((gap) => expect(gap).toBeCloseTo(0.5, 4));
    expect(xs[3]).toBeGreaterThan(0);
  });

  it('draws every pass up to draw_passes, each with its own mesh', async () => {
    const meshes = await meshesOf({
      ...ROW_OF_FOUR,
      draw_passes: '2',
      draw_pass_2: 'SubResource("Sphere")',
    });
    expect(meshes.map((mesh) => mesh.count)).toEqual([4, 4]);
    expect(meshes[0]!.geometry).not.toBe(meshes[1]!.geometry);
  });

  it('draws no pass that has no mesh (edge case)', async () => {
    const meshes = await meshesOf({ ...ROW_OF_FOUR, draw_passes: '2' });
    expect(meshes).toHaveLength(1);
  });

  it('draws nothing while the emitter is off', async () => {
    expect(await meshesOf({ ...ROW_OF_FOUR, emitting: 'false' })).toHaveLength(0);
  });

  it('draws nothing for an emitter with no process material (edge case)', async () => {
    const { process_material: _material, ...bare } = ROW_OF_FOUR;
    expect(await meshesOf(bare)).toHaveLength(0);
  });

  it('draws nothing for a ShaderMaterial, which this previewer does not run (edge case)', async () => {
    expect(await meshesOf({ ...ROW_OF_FOUR, process_material: 'SubResource("Shader")' })).toHaveLength(0);
  });

  it('draws the overlay over every pass', async () => {
    const meshes = await meshesOf({ ...ROW_OF_FOUR, material_overlay: 'SubResource("Overlay")' });
    expect(meshes).toHaveLength(2);
  });
});

/** Hands the test the camera the renderer draws through. */
function CameraProbe({ onCamera }: { onCamera: (camera: THREE.Camera) => void }) {
  onCamera(useThree((state) => state.camera));
  return null;
}

describe('<GPUParticles3D> draw order and alignment under a turning camera', () => {
  /** Draws `properties` through a camera that starts looking down -Z, and returns the mesh and a way to turn the camera a quarter about Y. */
  async function underCamera(properties: Record<string, string>) {
    let camera!: THREE.Camera;
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <CameraProbe onCamera={(found) => (camera = found)} />
        {emitter(properties)}
      </>
    );
    await renderer.advanceFrames(1, 0.016);
    return {
      /** Looked up again each time: a new draw may replace the mesh. */
      mesh: () => renderer.scene.findAll((node) => node.type === 'Mesh')[0]!.instance as THREE.InstancedMesh,
      async turnQuarter() {
        camera.rotation.y = Math.PI / 2;
        camera.updateMatrixWorld(true);
        // The frame reads the camera; the settle of its state draws the instances in a later act.
        await renderer.advanceFrames(1, 0.016);
        await ReactThreeTestRenderer.act(async () => undefined);
      },
    };
  }

  function instance(mesh: THREE.InstancedMesh, index: number): THREE.Matrix4 {
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(index, matrix);
    return matrix;
  }

  const xOf = (mesh: THREE.InstancedMesh, index: number) =>
    new THREE.Vector3().setFromMatrixPosition(instance(mesh, index)).x;

  it('sorts the instances along the camera again when it turns, for VIEW_DEPTH', async () => {
    const { mesh, turnQuarter } = await underCamera({ ...ROW_OF_FOUR, draw_order: '3' });
    // Square on, every depth ties and the index order keeps the oldest particle, the farthest along +x, first.
    expect(xOf(mesh(), 0)).toBeGreaterThan(xOf(mesh(), 3));
    await turnQuarter();
    expect(xOf(mesh(), 0)).toBeLessThan(xOf(mesh(), 3));
  });

  it('keeps the index order when the camera turns, for INDEX', async () => {
    const { mesh, turnQuarter } = await underCamera(ROW_OF_FOUR);
    await turnQuarter();
    expect(xOf(mesh(), 0)).toBeGreaterThan(xOf(mesh(), 3));
  });

  it('turns the instances to the camera again when it turns, for Z_BILLBOARD', async () => {
    const { mesh, turnQuarter } = await underCamera({ ...ROW_OF_FOUR, transform_align: '1' });
    expect(new THREE.Vector3().setFromMatrixColumn(instance(mesh(), 0), 0).x).toBeCloseTo(1, 4);
    await turnQuarter();
    expect(new THREE.Vector3().setFromMatrixColumn(instance(mesh(), 0), 0).z).toBeCloseTo(-1, 4);
  });
});
