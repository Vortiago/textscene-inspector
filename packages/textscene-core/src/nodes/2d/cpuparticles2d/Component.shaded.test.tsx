import type { ComponentProps } from 'react';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import type { CanvasItemCommands } from '../../../r3f/canvasShader/CanvasShaderSlot';
import { CanvasWorkspaceProvider } from '../../../r3f/contexts/CanvasWorkspaceContext';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { CPUParticles2D } from './Component';
import { parseCPUParticles2D } from './parser';
import { loadSimulate } from './simulateModule';

/** Written by the mocked `CanvasItem2D` on each render, cleared after each test. */
const asked = vi.hoisted(() => ({ shadedCommands: [] as Array<() => CanvasItemCommands | null> }));

vi.mock('../../../r3f/components/CanvasItem2D', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../r3f/components/CanvasItem2D')>();
  return {
    CanvasItem2D: (props: ComponentProps<typeof actual.CanvasItem2D>) => {
      if (props.shadedCommands) asked.shadedCommands.push(props.shadedCommands);
      return <actual.CanvasItem2D {...props} />;
    },
  };
});

afterEach(() => {
  asked.shadedCommands.length = 0;
});

beforeAll(loadSimulate);

const TEX = 'res://ball.png';

function emitter(raw: Record<string, string>): TscnNode {
  const heading = { type: 'node' as const, attributes: { type: 'CPUParticles2D', name: 'Fx' } };
  return {
    rawProperties: {},
    name: 'Fx',
    type: 'CPUParticles2D',
    children: [],
    properties: parseCPUParticles2D(heading, {
      texture: 'ExtResource("1")',
      use_fixed_seed: 'true',
      seed: '4242',
      fixed_fps: '30',
      preprocess: '0.95',
      ...raw,
    }),
  };
}

async function renderEmitter(node: TscnNode) {
  const fake = createFakeResourceLoader();
  const texture = new THREE.Texture();
  (texture as unknown as { image: { width: number; height: number } }).image = { width: 8, height: 4 };
  fake.textures.seed(TEX, texture);
  await ReactThreeTestRenderer.create(
    <CanvasWorkspaceProvider workspace="2d">
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={[]}
          externalResources={[{ id: '1', type: 'Texture2D', path: TEX }]}
        >
          <CPUParticles2D node={node} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    </CanvasWorkspaceProvider>
  );
  await ReactThreeTestRenderer.act(async () => {});
}

async function shadedCommandsOf(node: TscnNode) {
  await renderEmitter(node);
  return asked.shadedCommands.at(-1)!()!.commands;
}

describe('CPUParticles2D through the canvas template', () => {
  it("draws the pose as one multimesh of the texture's quad, a particle an instance (cpu_particles_2d.cpp:1293)", async () => {
    const [command, ...rest] = await shadedCommandsOf(emitter({ amount: '6', explosiveness: '1' }));

    expect([rest.length, command?.kind, command?.kind === 'multimesh' && command.instances.count]).toEqual([
      0,
      'multimesh',
      6,
    ]);
  });

  it('gives each particle its colour and its custom data, which INSTANCE_CUSTOM reads', async () => {
    const [command] = await shadedCommandsOf(emitter({ amount: '2' }));

    expect(
      command?.kind === 'multimesh' && [command.instances.usesColors, command.instances.usesCustomData]
    ).toEqual([true, true]);
  });

  it("writes each particle's lifetime phase and lifetime ratio in y and w of its custom data", async () => {
    const [command] = await shadedCommandsOf(emitter({ amount: '1', explosiveness: '1' }));
    const words = command?.kind === 'multimesh' ? command.instances.words : new Uint32Array(16);
    const [, phase, , ratio] = new Float32Array(words.buffer).slice(12, 16);

    expect([phase! > 0 && phase! < 1, ratio]).toEqual([true, 1]);
  });

  it("draws the texture's quad centred on the origin (cpu_particles_2d.cpp:184-229)", async () => {
    const [command] = await shadedCommandsOf(emitter({ amount: '1' }));
    const xs = command?.kind === 'multimesh' ? command.arrays.points.map(({ x, y }) => [x, y]) : [];

    expect(xs).toEqual([
      [-4, -2],
      [4, -2],
      [4, 2],
      [-4, 2],
    ]);
  });

  it('draws nothing while it is not emitting', async () => {
    await renderEmitter(emitter({ emitting: 'false' }));

    expect(asked.shadedCommands).toEqual([]);
  });
});
