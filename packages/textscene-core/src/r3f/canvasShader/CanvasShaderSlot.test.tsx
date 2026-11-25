import { act } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../logger';
import type { ShaderText } from '../../resources/materials/shadermaterial/types';
import { moduleWork } from '../../resources/memoisedImport';
import { CanvasShaderSlot } from './CanvasShaderSlot';

vi.mock('../canvasRenderer/canvasNodesHandler', () => ({ useNodesHandler: () => 'ready' }));
vi.mock('../projectShaderOptions', () => ({ useProjectShaderOptions: () => ({}) }));

const REFUSED = 'shader_type canvas_item;\nvoid fragment() { COLOR = 1; }\n';
const RECT = { x: 0, y: 0, w: 8, h: 4 };

function shaderOf(code: string): ShaderText {
  return { code, file: 'res://a.gdshader', parameters: {}, textures: {} };
}

async function renderSlot(code: string) {
  const texture = new THREE.DataTexture(new Uint8Array(8 * 4 * 4), 8, 4);
  return ReactThreeTestRenderer.create(
    <CanvasShaderSlot
      shader={shaderOf(code)}
      region={{ rect: RECT, source: RECT, clipUv: false }}
      texture={texture}
      canvasTexture={undefined}
      sampler={{ filter: 0, repeat: 0 }}
      finalModulate={{ r: 1, g: 1, b: 1, a: 1 }}
      fallback={<group name="fallback" />}
    />
  );
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

afterEach(() => vi.restoreAllMocks());

describe('CanvasShaderSlot', () => {
  it('draws the fallback while the translator loads', async () => {
    const renderer = await renderSlot('shader_type canvas_item;\n');

    expect(drawn(renderer)).toEqual(['Group:fallback']);
    await settle();
  });

  it('draws the fallback for a shader the translator refuses', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const renderer = await renderSlot(REFUSED);
    await settle();

    expect(drawn(renderer)).toEqual(['Group:fallback']);
  });

  it('draws the shader mesh, not the fallback, for a shader the translator compiles', async () => {
    const renderer = await renderSlot('shader_type canvas_item;\nvoid fragment() { COLOR = vec4(1.0); }\n');
    await settle();

    expect(drawn(renderer)).toEqual(['Mesh:']);
  });
});
