/**
 * The GLB processor honours an **Import sidecar**'s root scale (ADR-0027).
 *
 * The witness is the truck town's tree: a Sketchfab export whose `"tree"` node carries a
 * scale of 100, cancelled upstream by `nodes/root_scale=0.01`. With the sidecar dropped,
 * the previewer AND a fresh Godot import both render it ~100x too large — which is how
 * it went unnoticed, since the two agreed.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { FileEventBus } from '../FileEventBus';
import { ResourceEventBus } from '../ResourceEventBus';
import { createGLBProcessor } from './createGLBProcessor';
import { initGlbModules } from '../processing/glbProcessing';

const GLTF_PATH = 'res://town/tree/scene.gltf';

/** A minimal glTF whose single node carries the Sketchfab-style 100x scale. */
function gltfWithNodeScale(scale: number): ArrayBuffer {
  const gltf = {
    asset: { version: '2.0' },
    scenes: [{ nodes: [0] }],
    scene: 0,
    nodes: [{ name: 'tree', scale: [scale, scale, scale] }],
  };
  return new TextEncoder().encode(JSON.stringify(gltf)).buffer as ArrayBuffer;
}

const SIDECAR = '[remap]\n\nimporter="scene"\n\n[params]\n\nnodes/apply_root_scale=true\nnodes/root_scale=0.00999999999999999\n';

/**
 * Drive the processor the way the loader does: request the path, let the real
 * FileEventBus serve both the asset and (if present) its sidecar.
 */
async function loadWith(files: Record<string, string>): Promise<THREE.Object3D> {
  const fileEventBus = new FileEventBus({
    loadResource: vi.fn(async (path: string) =>
      path === GLTF_PATH ? gltfWithNodeScale(100) : (files[path] ?? null)
    ),
  });
  const eventBus = new ResourceEventBus();
  const processor = createGLBProcessor(fileEventBus, eventBus);

  const loaded = eventBus.once<THREE.Object3D>('glb', 'loaded', GLTF_PATH, 5000);
  processor.request(GLTF_PATH);
  return loaded;
}

/** The scale the asset's own content ends up at, in world space. */
function contentScale(root: THREE.Object3D): number {
  root.updateMatrixWorld(true);
  const node = root.getObjectByName('tree');
  return node!.getWorldScale(new THREE.Vector3()).x;
}

describe('createGLBProcessor — import sidecar', () => {
  beforeAll(async () => {
    await initGlbModules();
  });

  it('cancels the asset scale when the sidecar says to', async () => {
    const root = await loadWith({ [`${GLTF_PATH}.import`]: SIDECAR });
    // 100 (in the glTF) x 0.01 (from the sidecar) = 1.
    expect(contentScale(root)).toBeCloseTo(1, 6);
  });

  it('renders at import defaults when no sidecar exists', async () => {
    // Not a fallback — it is what a fresh Godot import of that project also produces.
    const root = await loadWith({});
    expect(contentScale(root)).toBeCloseTo(100, 4);
  });

  it('leaves the loaded root at scale 1, so .tscn children stay unscaled', async () => {
    const root = await loadWith({ [`${GLTF_PATH}.import`]: SIDECAR });
    expect(root.scale.toArray()).toEqual([1, 1, 1]);
  });

  it('ignores a sidecar whose root_scale is 1, the other 24 in the corpus', async () => {
    const root = await loadWith({
      [`${GLTF_PATH}.import`]: '[params]\n\nnodes/root_scale=1.0\nnodes/apply_root_scale=false\n',
    });
    expect(contentScale(root)).toBeCloseTo(100, 4);
  });

  it('survives a malformed sidecar rather than failing the asset', async () => {
    const root = await loadWith({ [`${GLTF_PATH}.import`]: 'not an ini file at all' });
    expect(contentScale(root)).toBeCloseTo(100, 4);
  });

  it('never reports the sidecar as a failed load', async () => {
    // A missing sidecar must not reach the Missing Resources panel: most assets have
    // none, and the panel is for resources a scene actually declares.
    const failed = vi.fn();
    const fileEventBus = new FileEventBus({
      loadResource: vi.fn(async (path: string) =>
        path === GLTF_PATH ? gltfWithNodeScale(100) : null
      ),
    });
    fileEventBus.on('failed', failed);
    const eventBus = new ResourceEventBus();
    const processor = createGLBProcessor(fileEventBus, eventBus);

    const loaded = eventBus.once<THREE.Object3D>('glb', 'loaded', GLTF_PATH, 5000);
    processor.request(GLTF_PATH);
    await loaded;

    expect(failed.mock.calls.map(([path]) => path)).not.toContain(`${GLTF_PATH}.import`);
  });
});
