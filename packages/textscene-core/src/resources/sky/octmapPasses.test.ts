import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FAST_FILTER_COEFFICIENTS } from '../../godot/rendering/environment/skyFastFilterCoefficients';
import { FAST_FILTER_HIGH_QUALITY_COEFFICIENTS } from '../../godot/rendering/environment/skyFastFilterHighQualityCoefficients';
import { nodeTestRenderer } from '../../testing/nodeTestRenderer';
import { testRenderer } from '../../testing/recordingWebGL';
import {
  coefficientWords,
  drawDownsample,
  drawFastFilter,
  filterInvocations,
  laidOut,
  roughnessValues,
} from './octmapPasses';

const LAYER = { chain: new THREE.Texture(), chainSize: 128, roughness: 0.5, size: 80, borderSize: 0.8 };

/** The floats of the words `coefficientWords` writes. */
const floatsOf = (words: Uint32Array) => new Float32Array(words.buffer);

/** The materials `renderer` draws with while `draw` runs. */
function materialsDrawnBy(renderer: THREE.WebGLRenderer, draw: () => void): THREE.Material[] {
  const materials: THREE.Material[] = [];
  const render = renderer.render.bind(renderer);
  renderer.render = (drawn, camera) => {
    materials.push((drawn as THREE.Mesh).material as THREE.Material);
    render(drawn, camera);
  };
  draw();
  return materials;
}

describe('roughnessValues', () => {
  it("squares the layer's roughness, as Godot remaps it", () => {
    expect(roughnessValues(LAYER)['params.roughness']).toBe(0.25);
  });

  it("draws Godot's default 32 GGX samples, under its cap of 64", () => {
    expect(roughnessValues(LAYER)['params.sample_count']).toBe(32);
  });

  it('writes the source directly only for layer 0, whose roughness is 0', () => {
    expect(
      [roughnessValues(LAYER), roughnessValues({ ...LAYER, roughness: 0 })].map(
        (values) => values['params.use_direct_write']
      )
    ).toEqual([false, true]);
  });

  it('gives the border as the padding, then 1 minus twice it', () => {
    const border = roughnessValues(LAYER)['params.border_size'] as THREE.Vector2;

    expect([border.x, border.y].map((part) => Number(part.toFixed(6)))).toEqual([0.1, 0.8]);
  });
});

describe('coefficientWords', () => {
  it("lays the low table's levels 120 floats apart, frames, lods and weights in Godot's order", () => {
    const floats = floatsOf(coefficientWords('low'));
    const level = FAST_FILTER_COEFFICIENTS[2]!;

    expect(floats).toHaveLength(7 * 120);
    expect(floats[2 * 120]).toBe(Math.fround(level.frameX[0]![0]!));
    expect(floats[2 * 120 + 72]).toBe(Math.fround(level.lod[0]![0]!));
  });

  it('copies the high table as it is, seven levels of 1,440 floats', () => {
    const floats = floatsOf(coefficientWords('high'));

    expect(floats).toHaveLength(7 * 1440);
    expect(floats.slice(0, 4)).toEqual(Float32Array.from(FAST_FILTER_HIGH_QUALITY_COEFFICIENTS.slice(0, 4)));
  });
});

describe('filterInvocations', () => {
  it('counts six 320 by 320 images on the texture array path', () => {
    expect(filterInvocations(true)).toBe(6 * 320 * 320);
  });

  it('halves the image for each mip on the path without arrays', () => {
    expect(filterInvocations(false)).toBe(
      [320, 160, 80, 40, 20, 10].reduce((sum, size) => sum + size * size, 0)
    );
  });
});

describe('laidOut', () => {
  it('lays images side by side, and starts a row where the next would pass 2048', () => {
    const atlas = laidOut(Array(6).fill(640));

    expect(atlas.origins.map(({ x, y }) => [x, y])).toEqual([
      [0, 0],
      [640, 0],
      [1280, 0],
      [0, 640],
      [640, 640],
      [1280, 640],
    ]);
    expect([atlas.target.width, atlas.target.height]).toEqual([1920, 1280]);
  });

  it("holds a probe's halving mips in one row (edge case)", () => {
    const atlas = laidOut([256, 128, 64, 32, 16, 8]);

    expect([atlas.target.width, atlas.target.height]).toEqual([504, 256]);
  });
});

describe('drawDownsample', () => {
  it('refuses a renderer with no nodes handler, as its pass is a node material (error case)', async () => {
    const { renderer } = await testRenderer();

    expect(() =>
      drawDownsample(renderer, new THREE.Texture(), new THREE.WebGLRenderTarget(4, 4), 4, 0.8)
    ).toThrow('expected a nodes handler on the renderer before a lowered pass draws');
  });

  it('draws with a pass of its own on each renderer (edge case)', async () => {
    const [{ renderer: first }, { renderer: second }] = [await nodeTestRenderer(), await nodeTestRenderer()];
    const drawOn = (renderer: THREE.WebGLRenderer) =>
      materialsDrawnBy(renderer, () =>
        drawDownsample(renderer, new THREE.Texture(), new THREE.WebGLRenderTarget(4, 4), 4, 0.8)
      );

    const [firstPass] = drawOn(first);

    expect(drawOn(second)).not.toContain(firstPass);
  });

  it('leaves the tone mapping the renderer had', async () => {
    const { renderer } = await nodeTestRenderer();
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    let drawnWith: THREE.ToneMapping | undefined;
    const render = renderer.render.bind(renderer);
    renderer.render = (drawn, camera) => {
      drawnWith = renderer.toneMapping;
      render(drawn, camera);
    };

    drawDownsample(renderer, new THREE.Texture(), new THREE.WebGLRenderTarget(4, 4), 4, 0.8);

    expect([drawnWith, renderer.toneMapping]).toEqual([THREE.NoToneMapping, THREE.ACESFilmicToneMapping]);
  });
});

const LOW_INTO_LAYERS = { quality: 'low', isTextureArray: true } as const;
const LOW_INTO_MIPS = { quality: 'low', isTextureArray: false } as const;

describe('drawFastFilter', () => {
  it("draws Godot's four scatters of a 2 by 2 block on the texture array path", async () => {
    const { renderer } = await nodeTestRenderer();

    const drawn = materialsDrawnBy(renderer, () =>
      drawFastFilter(renderer, new THREE.Texture(), 0.8, LOW_INTO_LAYERS, Array(6).fill(16))
    );

    expect(drawn).toHaveLength(4);
  });

  it('refuses other than six images (error case)', async () => {
    const { renderer } = await nodeTestRenderer();

    expect(() => drawFastFilter(renderer, new THREE.Texture(), 0.8, LOW_INTO_MIPS, [16, 16])).toThrow(
      'expected 6 images for the fast filter, got 2'
    );
  });
});
