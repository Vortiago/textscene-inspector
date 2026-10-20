/**
 * The GLB processor gives each embedded clip the name and loop mode Godot's importer gives it:
 * the glTF name rule, the name suffix rule and the sidecar's `_subresources.animations`
 * (`resource_importer_scene.cpp:745-755`, `:1335-1347`; `gltf_document.cpp:3752-3753`).
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { FileEventBus } from '../FileEventBus';
import { ResourceEventBus } from '../ResourceEventBus';
import { createGLBProcessor } from './createGLBProcessor';
import { DependencyGraph } from '../dependencyGraph';
import { AnimationLoopMode } from '../../godot/scene/animation';
import { importedLoopMode } from '../formats/glb/importedLoopMode';

const GLTF_PATH = 'res://player/player.gltf';

/** One node moved by every clip: its time input (2 keys) and translation output are shared. */
function animatedGltf(clipNames: string[]): ArrayBuffer {
  const data = new Float32Array([0, 1, 0, 0, 0, 1, 0, 0]);
  const base64 = Buffer.from(data.buffer).toString('base64');
  const gltf = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'Mover' }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [1] },
      { bufferView: 1, componentType: 5126, count: 2, type: 'VEC3' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 8 },
      { buffer: 0, byteOffset: 8, byteLength: 24 },
    ],
    buffers: [{ byteLength: 32, uri: `data:application/octet-stream;base64,${base64}` }],
    animations: clipNames.map((name) => ({
      name,
      samplers: [{ input: 0, output: 1 }],
      channels: [{ sampler: 0, target: { node: 0, path: 'translation' } }],
    })),
  };
  return new TextEncoder().encode(JSON.stringify(gltf)).buffer as ArrayBuffer;
}

function sidecar(params: string): string {
  return `[remap]\n\nimporter="scene"\n\n[params]\n\n${params}\n`;
}

function clipEntry(name: string, loopMode: number): string {
  return `"${name}": {\n"settings/loop_mode": ${loopMode}\n}`;
}

async function importClips(clipNames: string[], sidecarText?: string): Promise<Map<string, number>> {
  const asset = animatedGltf(clipNames);
  const fileEventBus = new FileEventBus({
    loadResource: vi.fn(async (path: string) =>
      path === GLTF_PATH ? asset : path === `${GLTF_PATH}.import` ? (sidecarText ?? null) : null
    ),
  });
  const eventBus = new ResourceEventBus();
  const processor = createGLBProcessor(fileEventBus, eventBus, new DependencyGraph());
  const loaded = eventBus.once<THREE.Object3D>('glb', 'loaded', GLTF_PATH, 5000);
  processor.request(GLTF_PATH);
  const root = await loaded;
  return new Map(root.animations.map((clip) => [clip.name, importedLoopMode(clip)]));
}

describe('createGLBProcessor — clip loop modes', () => {
  it('imports a clip with no loop word as LOOP_NONE', async () => {
    expect([...(await importClips(['walk']))]).toEqual([['walk', AnimationLoopMode.NONE]]);
  });

  it("names a clip as Godot's importer stores it, which has no dot", async () => {
    expect([...(await importClips(['idle_root.001']))]).toEqual([['idle_root_001', AnimationLoopMode.NONE]]);
  });

  it('loops a clip the glTF names loop and strips the suffix, as the importer does', async () => {
    expect([...(await importClips(['Walk_Loop', 'loopRun']))]).toEqual([
      ['Walk', AnimationLoopMode.LINEAR],
      ['loopRun', AnimationLoopMode.LINEAR],
    ]);
  });

  it('keeps a suffixed name when the sidecar turns name suffixes off', async () => {
    const text = sidecar('nodes/use_name_suffixes=false');
    expect([...(await importClips(['Walk_Loop'], text))]).toEqual([['Walk_Loop', AnimationLoopMode.LINEAR]]);
  });

  it("takes the mode of the sidecar's entry under the clip's final name", async () => {
    const text = sidecar(
      `_subresources={\n"animations": {\n${clipEntry('Walk', AnimationLoopMode.PINGPONG)}\n}\n}`
    );
    expect([...(await importClips(['Walk_Loop'], text))]).toEqual([['Walk', AnimationLoopMode.PINGPONG]]);
  });

  it('lets a sidecar entry without a loop mode make a looping name LOOP_NONE', async () => {
    const text = sidecar(
      'nodes/use_name_suffixes=false\n_subresources={\n"animations": {\n"loopRun": {}\n}\n}'
    );
    expect([...(await importClips(['loopRun'], text))]).toEqual([['loopRun', AnimationLoopMode.NONE]]);
  });
});
