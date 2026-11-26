import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { heading } from '../../../parser/testing/parserKit';
import type { CanvasItemCommands } from '../../../r3f/canvasShader/CanvasShaderSlot';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { subResource } from '../../../testing/subResource';
import { MultiMeshInstance2D } from './Component';
import { parseMultiMeshInstance2D } from './parser';

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

const QUAD = subResource('QuadMesh', 'Quad', { size: 'Vector2(10, 10)' });

async function renderMultiMesh(data: Record<string, string>) {
  const multiMesh = subResource('MultiMesh', 'MM', { mesh: 'SubResource("Quad")', ...data });
  const raw = { multimesh: 'SubResource("MM")' };
  const node = {
    rawProperties: raw,
    name: 'M',
    type: 'MultiMeshInstance2D',
    children: [],
    properties: parseMultiMeshInstance2D(heading('MultiMeshInstance2D', { name: 'M' }), raw),
  };
  await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={createFakeResourceLoader().loader}>
      <SceneResourcesProvider internalResources={[QUAD, multiMesh]}>
        <MultiMeshInstance2D node={node} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  await ReactThreeTestRenderer.act(async () => {});
  return asked.shadedCommands.at(-1)!()!.commands;
}

describe('MultiMeshInstance2D through the canvas template', () => {
  it('draws its mesh as one multimesh command of every instance (renderer_canvas_render_rd.cpp:2769)', async () => {
    const commands = await renderMultiMesh({
      transform_format: '0',
      instance_count: '2',
      buffer: 'PackedFloat32Array(1, 0, 0, 3, 0, 1, 0, 4, 1, 0, 0, 5, 0, 1, 0, 6)',
    });

    expect(commands.map((command) => command.kind === 'multimesh' && command.instances.count)).toEqual([2]);
  });

  it('carries the colours and custom data its MultiMesh uses', async () => {
    const [command] = await renderMultiMesh({
      transform_format: '0',
      use_colors: 'true',
      use_custom_data: 'true',
      instance_count: '1',
      buffer: 'PackedFloat32Array(1, 0, 0, 3, 0, 1, 0, 4, 1, 0.5, 0.25, 1, 0, 0, 0.5, 0)',
    });

    expect(
      command?.kind === 'multimesh' && [command.instances.usesColors, command.instances.usesCustomData]
    ).toEqual([true, true]);
  });
});
