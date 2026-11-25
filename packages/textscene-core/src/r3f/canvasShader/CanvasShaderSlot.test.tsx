import { act } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../logger';
import type { ShaderText } from '../../resources/materials/shadermaterial/types';
import { moduleWork } from '../../resources/memoisedImport';
import { CanvasShaderSlot } from './CanvasShaderSlot';

const nodesHandler = vi.hoisted(() => ({ state: 'ready' as 'ready' | 'loading' }));
vi.mock('../canvasRenderer/canvasNodesHandler', () => ({ useNodesHandler: () => nodesHandler.state }));
const shaderOptions = vi.hoisted(() => ({}));
vi.mock('../projectShaderOptions', () => ({ useProjectShaderOptions: () => shaderOptions }));

const REFUSED = 'shader_type canvas_item;\nvoid fragment() { COLOR = 1; }\n';
const RECT = { x: 0, y: 0, w: 8, h: 4 };
const WHITE = { r: 1, g: 1, b: 1, a: 1 };

function shaderOf(code: string): ShaderText {
  return { code, file: 'res://a.gdshader', parameters: {}, textures: {} };
}

const COMPILED = 'shader_type canvas_item;\nvoid fragment() { COLOR = vec4(1.0); }\n';
const SAMPLER = { filter: 0, repeat: 0 };
const TEXTURE = new THREE.DataTexture(new Uint8Array(8 * 4 * 4), 8, 4);

function slotOf(shader: ShaderText, rectX = 0) {
  return (
    <CanvasShaderSlot
      shader={shader}
      commands={[
        {
          kind: 'rect',
          region: { rect: { ...RECT, x: rectX }, source: RECT, clipUv: false },
          modulate: WHITE,
        },
      ]}
      texture={TEXTURE}
      canvasTexture={undefined}
      sampler={SAMPLER}
      finalModulate={WHITE}
      firstOrder={0}
      fallback={<group name="fallback" />}
    />
  );
}

async function renderSlot(code: string) {
  return ReactThreeTestRenderer.create(slotOf(shaderOf(code)));
}

function drawn(renderer: Awaited<ReturnType<typeof renderSlot>>): string[] {
  return renderer.scene.children.map((child) => `${child.type}:${child.props.name ?? ''}`);
}

async function settle() {
  await vi.waitFor(() => expect(moduleWork.pending()).toBe(0), { timeout: 10_000 });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  nodesHandler.state = 'ready';
});

describe('CanvasShaderSlot', () => {
  // Three's node handler, not the module: another file in the worker may have loaded the module already.
  it('draws the fallback while the translator loads', async () => {
    nodesHandler.state = 'loading';
    const renderer = await renderSlot('shader_type canvas_item;\n');
    await settle();

    expect(drawn(renderer)).toEqual(['Group:fallback']);
  });

  it('draws the fallback for a shader the translator refuses', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const renderer = await renderSlot(REFUSED);
    await settle();

    expect(drawn(renderer)).toEqual(['Group:fallback']);
  });

  it('draws the shader mesh, not the fallback, for a shader the translator compiles', async () => {
    const renderer = await renderSlot(COMPILED);
    await settle();

    expect(drawn(renderer)).toEqual(['Object3D:']);
  });

  it('keeps its draw for commands of the same layout, as the next frame of an animation gives', async () => {
    const shader = shaderOf(COMPILED);
    const renderer = await ReactThreeTestRenderer.create(slotOf(shader));
    await settle();
    const first = renderer.scene.children[0]!.instance;

    await renderer.update(slotOf(shader, 3));
    await settle();

    expect(renderer.scene.children[0]!.instance).toBe(first);
  });
});
