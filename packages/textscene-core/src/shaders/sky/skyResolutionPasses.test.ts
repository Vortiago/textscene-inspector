import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SkyResolutionPasses } from './skyResolutionPasses.js';
import { transpileSky, type SkyDraw, type TranspiledSky } from './transpileSky.js';

const BOTH_PASSES = `shader_type sky;
render_mode use_half_res_pass, use_quarter_res_pass;
void sky() { COLOR = HALF_RES_COLOR.rgb + QUARTER_RES_COLOR.rgb; }`;

/** A renderer that records the target size of each draw, in order, and the target it is left on. */
function recordingRenderer(initial: THREE.WebGLRenderTarget | null = null) {
  const draws: string[] = [];
  let current = initial;
  const renderer = {
    getRenderTarget: () => current,
    getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0,
    setRenderTarget: (target: THREE.WebGLRenderTarget | null) => (current = target),
    render: () => draws.push(`${current!.width}x${current!.height}`),
  } as unknown as THREE.WebGLRenderer;
  return { renderer, draws, current: () => current };
}

function drawsOf(sky: TranspiledSky, size: THREE.Vector2): string[] {
  const { renderer, draws } = recordingRenderer();
  new SkyResolutionPasses(sky).draw(renderer, new THREE.Camera(), size);
  return draws;
}

/** The targets, by the radiance mip each stands for. */
function targetsByMip(passes: SkyResolutionPasses): Map<number, THREE.WebGLRenderTarget> {
  const targets = new Map<number, THREE.WebGLRenderTarget>();
  passes.forEachTarget((target, mip) => targets.set(mip, target));
  return targets;
}

describe('SkyResolutionPasses', () => {
  it('draws the quarter pass, then the half pass, at a quarter and a half of the size', () => {
    expect(drawsOf(transpileSky(BOTH_PASSES), new THREE.Vector2(800, 600))).toEqual(['200x150', '400x300']);
  });

  it('sizes the passes from a screen of at least 4 by 4, as Godot does (edge case)', () => {
    expect(drawsOf(transpileSky(BOTH_PASSES), new THREE.Vector2(2, 1))).toEqual(['1x1', '2x2']);
  });

  it('makes no target for a sky without the render modes', () => {
    expect(new SkyResolutionPasses(transpileSky('shader_type sky;\nvoid sky() {}')).isEmpty).toBe(true);
  });

  it('gives the full pass both targets, and each smaller pass only the other one', () => {
    const sky = transpileSky(BOTH_PASSES);
    const unset = sky.half!.textures.get('half_res')?.value;
    new SkyResolutionPasses(sky);
    const read = (draw: SkyDraw | undefined, name: string) => draw?.textures.get(name)?.value;
    expect(read(sky, 'half_res')).toBeInstanceOf(THREE.Texture);
    expect(read(sky, 'half_res')).not.toBe(read(sky, 'quarter_res'));
    expect(read(sky.half, 'quarter_res')).toBe(read(sky, 'quarter_res'));
    expect(read(sky.half, 'half_res')).toBe(unset);
  });

  it('gives every draw the target of a size it has no pass of, as the octmap pass reads its mips', () => {
    const sky = transpileSky(`shader_type sky;
render_mode use_quarter_res_pass;
void sky() { COLOR = HALF_RES_COLOR.rgb + QUARTER_RES_COLOR.rgb; }`);
    const half = targetsByMip(new SkyResolutionPasses(sky, ['half', 'quarter'])).get(1)!.texture;
    expect(sky.textures.get('half_res')?.value).toBe(half);
    expect(sky.quarter!.textures.get('half_res')?.value).toBe(half);
  });

  it('sizes the target of a size it has no pass of, and draws only the passes the sky has', () => {
    const sky = transpileSky('shader_type sky;\nvoid sky() { COLOR = HALF_RES_COLOR.rgb; }');
    const { renderer, draws } = recordingRenderer();
    const passes = new SkyResolutionPasses(sky, ['half', 'quarter']);
    passes.draw(renderer, new THREE.Camera(), new THREE.Vector2(80, 80));
    expect(draws).toEqual([]);
    expect([...targetsByMip(passes)].map(([mip, target]) => [mip, target.width])).toEqual([
      [2, 20],
      [1, 40],
    ]);
    expect(passes.isEmpty).toBe(true);
  });

  it('lists the target of a size the sky draws a pass of, as a smaller pass reads it first (edge case)', () => {
    const sky = transpileSky(BOTH_PASSES);
    expect([...targetsByMip(new SkyResolutionPasses(sky)).keys()]).toEqual([2, 1]);
  });

  it('leaves the renderer on the target it had', () => {
    const previous = new THREE.WebGLRenderTarget(1, 1);
    const recording = recordingRenderer(previous);
    new SkyResolutionPasses(transpileSky(BOTH_PASSES)).draw(
      recording.renderer,
      new THREE.Camera(),
      new THREE.Vector2(8, 8)
    );
    expect(recording.current()).toBe(previous);
  });
});
