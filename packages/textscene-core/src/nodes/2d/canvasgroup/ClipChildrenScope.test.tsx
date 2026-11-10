/**
 * `clip_children` through the pass of its canvas: a Polygon2D parent renders with a child square,
 * then `drawCanvasGroups` runs over the scene with a recording renderer. The parent's mask is read
 * off its compiled program, as the pass switches a uniform of it.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { offscreenRendererState } from '../../viewport/subviewport/offscreenRenderer.testkit';
import type { TscnNode } from '../../../parser/types';
import { Polygon2D } from '../polygon2d/Component';
import { parsePolygon2D } from '../polygon2d/parser';
import { PaintRangeProvider } from '../../../r3f/contexts/PaintOrderContext';
import { canvasRenderOrder, layerRankOf, layerRanks } from '../../../r3f/canvasPaintOrder';
import {
  CanvasLighting2DContext,
  INERT_CANVAS_LIGHTING,
  type CanvasLighting2D,
} from '../../../r3f/lighting2d/lightPassContext';
import type { CanvasClip } from '../../../r3f/lighting2d/lightPassHost';
import { drawCanvasGroups } from '../../../r3f/canvasGroup/canvasGroupPass';

vi.mock('../../../r3f/texelCopy', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../r3f/texelCopy')>()),
  copyTexels: vi.fn(),
}));

const WORLD_RANK = layerRankOf(layerRanks([]), 0);
const RUN = { base: 10, size: 4 };
const CHILD_KEY = canvasRenderOrder({ layerRank: WORLD_RANK, zFinal: 0, sequence: RUN.base + 1 });
const ROOT_CLIP: CanvasClip = { rect: { x: 0, y: -648, w: 1152, h: 648 }, scale: { x: 1, y: 1 } };
const LIGHTING: CanvasLighting2D = {
  ...INERT_CANVAS_LIGHTING,
  registerPassStep: (step) => {
    step(new THREE.OrthographicCamera(), ROOT_CLIP);
    return () => {};
  },
};

function parentNode(rawProps: Record<string, string>): TscnNode {
  const heading = { type: 'node' as const, attributes: { name: 'Parent', type: 'Polygon2D' } };
  const polygon = 'PackedVector2Array(0, 0, 100, 0, 100, 100, 0, 100)';
  return {
    rawProperties: {},
    name: 'Parent',
    type: 'Polygon2D',
    children: [],
    properties: parsePolygon2D(heading, { polygon, ...rawProps }),
  };
}

/** A unit square at the origin, inside the view of the default camera, under a wrapper at the child key. */
function ChildSquare() {
  return (
    <group renderOrder={CHILD_KEY}>
      <mesh name="child" geometry={new THREE.PlaneGeometry(1, 1)} />
    </group>
  );
}

/** What the pass draws, per render call: the target bound, the meshes seen, and the parent's mask. */
async function drawParent(rawProps: Record<string, string>) {
  const renderer = await ReactThreeTestRenderer.create(
    <CanvasLighting2DContext.Provider value={LIGHTING}>
      <PaintRangeProvider value={RUN}>
        <Polygon2D node={parentNode(rawProps)}>
          <ChildSquare />
        </Polygon2D>
      </PaintRangeProvider>
    </CanvasLighting2DContext.Provider>
  );
  const scene = renderer.scene.instance as THREE.Scene;
  const parent = scene.getObjectByProperty('type', 'Mesh') as THREE.Mesh;
  const child = scene.getObjectByName('child')!;
  const program = { uniforms: {} as Record<string, THREE.IUniform>, ...compiledSources() };
  (parent.material as THREE.Material).onBeforeCompile(
    program as unknown as THREE.WebGLProgramParametersWithUniforms,
    null as never
  );

  const camera = new THREE.OrthographicCamera();
  const draws: { target: unknown; seen: string[]; masking: number | undefined; readsTarget: boolean }[] = [];
  let bound: unknown = null;
  const gl = {
    ...offscreenRendererState(),
    getRenderTarget: () => bound,
    setRenderTarget: (target: unknown) => {
      bound = target;
    },
    clear: () => {},
    render: () => {
      const seen = [parent, child]
        .filter((mesh) => camera.layers.test(mesh.layers))
        .map((mesh) => mesh.name || 'parent');
      const target = bound as THREE.WebGLRenderTarget | null;
      draws.push({
        target: bound,
        seen,
        masking: program.uniforms.uClipMasking?.value as number | undefined,
        // WebGL refuses a draw that samples a texture of the framebuffer it draws into.
        readsTarget: target !== null && program.uniforms.uClipBuffer?.value === target.texture,
      });
    },
  } as unknown as THREE.WebGLRenderer;
  const frame = { width: 64, height: 64, texture: new THREE.Texture() };
  drawCanvasGroups(gl, scene, camera, frame, () => gl.render(scene, camera));
  return { draws, program };
}

/** The vertex and fragment text of three's unlit mesh program, which the mask edits. */
function compiledSources() {
  return {
    vertexShader: THREE.ShaderLib.basic.vertexShader,
    fragmentShader: THREE.ShaderLib.basic.fragmentShader,
  };
}

describe('clip_children on a Polygon2D', () => {
  it('draws the child into a buffer and the parent over the frame under its mask', async () => {
    const { draws } = await drawParent({ clip_children: '1' });

    expect(draws.map(({ seen, masking }) => ({ seen, masking }))).toEqual([
      { seen: [], masking: 0 },
      { seen: ['child'], masking: 0 },
      { seen: ['parent'], masking: 1 },
    ]);
    expect(draws[1]!.target).not.toBeNull();
  });

  it('takes the alpha of the owner before its lighting, which its mask shader does not apply', async () => {
    const { program } = await drawParent({ clip_children: '1' });

    expect(program.fragmentShader).toMatch(/gl_FragColor\.a\s*=\s*diffuseColor\.a/);
  });

  it('reads the buffer at the fragment and keeps the parent alpha', async () => {
    const { program } = await drawParent({ clip_children: '1' });

    expect(program.fragmentShader).toMatch(/gl_FragColor\.rgb\s*=\s*texelFetch\(\s*uClipBuffer/);
    expect(program.fragmentShader).not.toMatch(/gl_FragColor\.a\s*=\s*texelFetch/);
  });

  it('draws the parent into the buffer first in CLIP_AND_DRAW, unmasked', async () => {
    const { draws } = await drawParent({ clip_children: '2' });

    expect(draws.map(({ seen, masking }) => ({ seen, masking }))).toEqual([
      { seen: [], masking: 0 },
      { seen: ['parent'], masking: 0 },
      { seen: ['child'], masking: 0 },
      { seen: ['parent'], masking: 1 },
    ]);
  });

  it('binds no buffer to the owner while the buffer is the target it draws into', async () => {
    const { draws } = await drawParent({ clip_children: '2' });

    expect(draws.map(({ readsTarget }) => readsTarget)).toEqual([false, false, false, false]);
  });

  it('draws a Polygon2D without clip_children as one frame', async () => {
    const { draws } = await drawParent({});

    expect(draws).toHaveLength(1);
    expect(draws[0]!.seen).toEqual(['parent', 'child']);
  });
});
